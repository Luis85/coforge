// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObsClient, obsAuthentication, type ObsSocket } from "../../../infrastructure/coforge/obs-client";
import { ObsAdapter } from "../../../infrastructure/coforge/obs-adapter";
import { defaultObsSettings } from "../../../features/coforge/domain/obs";
import { nodeTimers } from "./memory-storage";

class Socket implements ObsSocket {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onclose: ((event: CloseEvent) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  sent: Array<{ op: number; d: Record<string, unknown> }> = [];
  reply: ((frame: { op: number; d: Record<string, unknown> }) => void) | undefined;
  send(value: string) {
    const frame = JSON.parse(value);
    this.sent.push(frame);
    this.reply?.(frame);
  }
  close() {
    this.onclose?.(new CloseEvent("close", { code: 1006 }));
  }
  frame(value: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(value) }));
  }
}
const stops: Array<() => void> = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.useRealTimers();
});
const hello = { op: 0, d: { rpcVersion: 1 } };
const identified = { op: 2, d: { negotiatedRpcVersion: 1 } };
describe("OBS WebSocket v5 boundary", () => {
  it("matches an independently calculated SHA256 challenge vector without transmitting the password", async () => {
    const value = obsAuthentication(
      "supersecretpassword",
      "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=",
      "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=",
    );
    expect(value).toBe("1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4=");
    const socket = new Socket();
    const client = new ObsClient(
      () => socket,
      nodeTimers(),
      () => "supersecretpassword",
      () => undefined,
      () => undefined,
    );
    stops.push(() => client.disconnect());
    const connecting = client.connect("ws://127.0.0.1:4455/", "obs-password");
    socket.frame({ op: 0, d: { rpcVersion: 1, authentication: { salt: "salt", challenge: "challenge" } } });
    expect(JSON.stringify(socket.sent)).not.toContain("supersecretpassword");
    socket.frame(identified);
    await connecting;
    expect(socket.sent[0]).toMatchObject({ op: 1, d: { rpcVersion: 1, eventSubscriptions: 71 } });
  });
  it("holds a disconnected mutation and never replays it on reconnect", async () => {
    vi.useFakeTimers();
    const sockets: Socket[] = [];
    const client = new ObsClient(
      () => {
        const socket = new Socket();
        sockets.push(socket);
        return socket;
      },
      nodeTimers(),
      () => null,
      () => undefined,
      () => undefined,
    );
    stops.push(() => client.disconnect());
    const connecting = client.connect("ws://127.0.0.1:4455/", "obs-password");
    sockets[0]!.frame(hello);
    sockets[0]!.frame(identified);
    await connecting;
    const request = client.request("StartStream");
    const rejected = expect(request).rejects.toMatchObject({ kind: "uncertain" });
    sockets[0]!.close();
    await rejected;
    await vi.advanceTimersByTimeAsync(1000);
    sockets[1]!.frame(hello);
    sockets[1]!.frame(identified);
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets[1]!.sent.some((frame) => frame.d.requestType === "StartStream")).toBe(false);
  });
  it("rejects incomplete responses without leaving a request unresolved", async () => {
    const socket = new Socket();
    const client = new ObsClient(
      () => socket,
      nodeTimers(),
      () => null,
      () => undefined,
      () => undefined,
    );
    stops.push(() => client.disconnect());
    const connecting = client.connect("ws://127.0.0.1:4455/", "obs-password");
    socket.frame(hello);
    socket.frame(identified);
    await connecting;
    const request = client.request("StartStream");
    const frame = socket.sent.at(-1)!;
    socket.frame({ op: 7, d: { requestId: frame.d.requestId, requestType: "StartStream", requestStatus: null } });
    await expect(request).rejects.toMatchObject({ kind: "uncertain" });
  });
  it("uses only supported stream/scene requests and confirms real state before resolving actions", async () => {
    const socket = new Socket();
    let active = false;
    let scene = "Gameplay";
    let failSceneReadback = false;
    const allowed = [
      "GetVersion",
      "GetSceneList",
      "GetStreamStatus",
      "SetCurrentProgramScene",
      "StartStream",
      "StopStream",
    ];
    socket.reply = (frame) => {
      if (frame.op === 1) {
        socket.frame(identified);
        return;
      }
      if (frame.op !== 6) return;
      const type = frame.d.requestType;
      expect(allowed).toContain(type);
      let response: unknown = {};
      if (type === "GetVersion") response = { availableRequests: allowed };
      if (type === "GetSceneList")
        response = {
          currentProgramSceneName: scene,
          scenes: [
            { sceneName: "Gameplay", sceneUuid: "live" },
            { sceneName: "BRB", sceneUuid: "brb" },
          ],
        };
      if (type === "GetStreamStatus")
        response =
          failSceneReadback && scene === "BRB"
            ? {}
            : { outputActive: active, outputReconnecting: false, outputTimecode: "00:00:00.000" };
      if (type === "StartStream") active = true;
      if (type === "StopStream") active = false;
      if (type === "SetCurrentProgramScene") {
        const data = frame.d.requestData;
        if (data && typeof data === "object" && "sceneName" in data && typeof data.sceneName === "string")
          scene = data.sceneName;
      }
      socket.frame({
        op: 7,
        d: {
          requestId: frame.d.requestId,
          requestType: type,
          requestStatus: { result: true, code: 100 },
          responseData: response,
        },
      });
    };
    const adapter = new ObsAdapter(
      () => {
        void Promise.resolve().then(() => socket.frame(hello));
        return socket;
      },
      nodeTimers(),
      { getSecret: () => null, setSecret: () => undefined },
    );
    stops.push(() => adapter.dispose());
    await adapter.connect(defaultObsSettings());
    expect((await adapter.startStream()).active).toBe(true);
    expect((await adapter.selectScene("brb")).programSceneId).toBe("brb");
    expect(active).toBe(true);
    expect((await adapter.stopStream()).active).toBe(false);
    await adapter.selectScene("live");
    failSceneReadback = true;
    await expect(adapter.selectScene("brb")).rejects.toMatchObject({ kind: "uncertain" });
  });
});
