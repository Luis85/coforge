import { createHash } from "node:crypto";
import type { Timers } from "../../features/coforge/application/ports";
import type { ObsConnection } from "../../features/coforge/domain/obs";
import { record } from "../../features/coforge/domain/check";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
import type { ObsSceneRequest } from './obs-scenes-data';

export type ObsRequest =
  "GetVersion" | "GetSceneList" | "GetStreamStatus" | "GetStats" | "SetCurrentProgramScene" | "StartStream" | "StopStream" | ObsSceneRequest;
export interface ObsSocket {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onclose: ((event: CloseEvent) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  send(value: string): void;
  close(): void;
}
interface Pending {
  type: ObsRequest;
  mutation: boolean;
  timer: number;
  resolve(value: Record<string, unknown>): void;
  reject(error: IntegrationFailure): void;
}
export const obsAuthentication = (password: string, salt: string, challenge: string): string => {
  const secret = createHash("sha256")
    .update(password + salt)
    .digest("base64");
  return createHash("sha256")
    .update(secret + challenge)
    .digest("base64");
};
/** Scoped v5 JSON RPC. No raw responses, endpoint, authentication material or server comments are logged. */
export class ObsClient {
  private socket: ObsSocket | undefined;
  private readonly pending = new Map<string, Pending>();
  private generation = 0;
  private ready = false;
  private identifySent = false;
  private wanted = false;
  private retry: number | undefined;
  private handshake: number | undefined;
  private attempts = 0;
  private endpoint = "";
  private secretName = "";
  private identify: { resolve(): void; reject(error: IntegrationFailure): void } | undefined;
  constructor(
    private readonly factory: (url: string) => ObsSocket,
    private readonly timers: Timers,
    private readonly password: (key: string) => string | null,
    private readonly connection: (phase: ObsConnection, error?: string) => void,
    private readonly event: (type: string, data: Record<string, unknown>) => void,
  ) {}
  async connect(endpoint: string, secretName: string): Promise<void> {
    this.disconnect();
    this.endpoint = endpoint;
    this.secretName = secretName;
    this.wanted = true;
    this.attempts = 0;
    await this.open();
  }
  disconnect(): void {
    this.wanted = false;
    this.ready = false;
    this.generation++;
    if (this.retry !== undefined) this.timers.clearTimeout(this.retry);
    this.retry = undefined;
    if (this.handshake !== undefined) this.timers.clearTimeout(this.handshake);
    this.handshake = undefined;
    this.identify?.reject(new IntegrationFailure("service", "OBS connection was closed."));
    this.identify = undefined;
    this.rejectPending();
    const socket = this.socket;
    this.socket = undefined;
    try {
      socket?.close();
    } catch {
      /* Closing an already closed socket has no external effect. */
    }
    this.connection("disconnected");
  }
  get epoch(): number {
    return this.generation;
  }
  get connected(): boolean {
    return this.ready;
  }
  request(type: ObsRequest, data?: Record<string, unknown>, timeoutMs = 8000): Promise<Record<string, unknown>> {
    if (!this.ready || !this.socket)
      return Promise.reject(new IntegrationFailure("validation", "Connect OBS before requesting stream controls."));
    if (this.pending.size >= 32)
      return Promise.reject(
        new IntegrationFailure("service", "OBS has too many pending requests. Wait and refresh its status."),
      );
    const mutation = !type.startsWith("Get");
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = this.timers.setTimeout(() => {
        this.pending.delete(id);
        reject(
          new IntegrationFailure(
            mutation ? "uncertain" : "service",
            mutation
              ? "OBS did not confirm this action. Refresh its status before trying again."
              : "OBS did not return its status in time.",
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { type, mutation, timer, resolve, reject });
      try {
        this.socket?.send(
          JSON.stringify({ op: 6, d: { requestType: type, requestId: id, ...(data ? { requestData: data } : {}) } }),
        );
      } catch {
        this.pending.delete(id);
        this.timers.clearTimeout(timer);
        reject(
          new IntegrationFailure(
            mutation ? "uncertain" : "service",
            "The OBS connection ended before the operation was confirmed.",
          ),
        );
      }
    });
  }
  private open(): Promise<void> {
    const generation = ++this.generation;
    this.ready = false;
    this.identifySent = false;
    this.connection(this.attempts ? "reconnecting" : "connecting");
    return new Promise((resolve, reject) => {
      this.identify = { resolve, reject };
      let socket: ObsSocket;
      try {
        socket = this.factory(this.endpoint);
      } catch {
        this.lost(generation, false);
        return;
      }
      this.socket = socket;
      this.handshake = this.timers.setTimeout(
        () => this.lost(generation, true, "OBS WebSocket v5 did not finish its handshake. Check the server and port."),
        10000,
      );
      socket.onmessage = (event) => {
        if (generation !== this.generation || !this.wanted) return;
        try {
          this.receive(event.data);
        } catch {
          this.lost(
            generation,
            true,
            "OBS returned an invalid protocol message. Check that its WebSocket server uses v5.",
          );
        }
      };
      socket.onclose = (event) => {
        if (generation === this.generation)
          this.lost(
            generation,
            event.code >= 4000,
            event.code === 4009
              ? "OBS rejected authentication. Save the correct WebSocket password and reconnect."
              : undefined,
          );
      };
      socket.onerror = () => this.lost(generation, false);
    });
  }
  private receive(raw: unknown): void {
    if (typeof raw !== "string" || raw.length > 1_048_576) return;
    const frame = record(JSON.parse(raw));
    const data = record(frame.d ?? {});
    if (frame.op === 0 && !this.ready) {
      if (this.identifySent) return;
      if (typeof data.rpcVersion !== "number" || data.rpcVersion < 1) throw new Error("Unsupported RPC");
      let authentication: string | undefined;
      if (data.authentication !== undefined) {
        const challenge = record(data.authentication);
        const password = this.password(this.secretName);
        if (
          !password ||
          typeof challenge.salt !== "string" ||
          typeof challenge.challenge !== "string" ||
          challenge.salt.length > 1024 ||
          challenge.challenge.length > 1024
        ) {
          this.lost(this.generation, true, "Save the OBS WebSocket password in CoForge and reconnect.");
          return;
        }
        authentication = obsAuthentication(password, challenge.salt, challenge.challenge);
      }
      this.connection("authenticating");
      this.identifySent = true;
      this.socket?.send(
        JSON.stringify({
          op: 1,
          d: { rpcVersion: 1, eventSubscriptions: 207, ...(authentication ? { authentication } : {}) },
        }),
      );
    } else if (frame.op === 2 && !this.ready) {
      if (data.negotiatedRpcVersion !== 1) throw new Error("Unsupported RPC");
      if (this.handshake !== undefined) this.timers.clearTimeout(this.handshake);
      this.handshake = undefined;
      this.ready = true;
      this.attempts = 0;
      this.connection("connected");
      this.identify?.resolve();
      this.identify = undefined;
    } else if (frame.op === 7 && this.ready && typeof data.requestId === "string") {
      const pending = this.pending.get(data.requestId);
      if (!pending || data.requestType !== pending.type) return;
      try {
        const status = record(data.requestStatus);
        const response = record(data.responseData ?? {});
        this.pending.delete(data.requestId);
        this.timers.clearTimeout(pending.timer);
        if (status.result === true && status.code === 100) pending.resolve(response);
        else if (status.result === false && typeof status.code === "number")
          pending.reject(
            new IntegrationFailure(
              "delivery",
              "OBS rejected this request. Refresh its state and check the selected scene or broadcast configuration.",
            ),
          );
        else
          pending.reject(
            new IntegrationFailure(
              pending.mutation ? "uncertain" : "service",
              "OBS returned an invalid request confirmation. Refresh its status.",
            ),
          );
      } catch {
        this.pending.delete(data.requestId);
        this.timers.clearTimeout(pending.timer);
        pending.reject(
          new IntegrationFailure(
            pending.mutation ? "uncertain" : "service",
            "OBS returned an incomplete request confirmation. Refresh its status.",
          ),
        );
      }
    } else if (frame.op === 5 && this.ready && typeof data.eventType === "string") {
      this.event(data.eventType, record(data.eventData ?? {}));
    }
  }
  private rejectPending(): void {
    for (const pending of this.pending.values()) {
      this.timers.clearTimeout(pending.timer);
      pending.reject(
        new IntegrationFailure(
          pending.mutation ? "uncertain" : "service",
          "OBS disconnected before confirming this operation. Refresh its status; actions are never replayed automatically.",
        ),
      );
    }
    this.pending.clear();
  }
  private lost(
    generation: number,
    terminal: boolean,
    message = "OBS connection was lost. Check OBS Studio and its WebSocket server.",
  ): void {
    if (generation !== this.generation || !this.wanted) return;
    this.generation++;
    this.ready = false;
    if (this.handshake !== undefined) this.timers.clearTimeout(this.handshake);
    this.handshake = undefined;
    this.identify?.reject(new IntegrationFailure(terminal ? "authorization" : "service", message));
    this.identify = undefined;
    this.rejectPending();
    const socket = this.socket;
    this.socket = undefined;
    try {
      socket?.close();
    } catch {
      /* Disconnected. */
    }
    if (terminal) {
      this.wanted = false;
      this.connection("error", message);
      return;
    }
    this.connection("reconnecting", message);
    const delay = Math.min(15000, 1000 * 2 ** Math.min(this.attempts++, 4));
    this.retry = this.timers.setTimeout(() => {
      this.retry = undefined;
      if (this.wanted) void this.open().catch(() => undefined);
    }, delay);
  }
}
