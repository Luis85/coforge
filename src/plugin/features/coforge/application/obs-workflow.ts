import type { StudioStore } from "./studio-store";
import type { ObsControlPort } from "./obs-port";
import { record } from "../domain/check";
import { IntegrationFailure } from "../domain/integration-failure";
import {
  emptyObsState,
  type ObsCommandKind,
  type ObsObservation,
  type ObsPublicState,
  type ObsSnapshot,
} from "../domain/obs";
import { obsSettingsCheck } from "../domain/obs-check";
import type { OperationCode } from "../domain/population";
import { recordOperation } from "./population";
import { executeObsCommand } from "./obs-commands";

const requested: Record<ObsCommandKind, OperationCode> = {
  prepare: "stream-prepare-requested",
  "go-live": "stream-go-live-requested",
  pause: "stream-pause-requested",
  resume: "stream-resume-requested",
  stop: "stream-stop-requested",
};
const confirmed: Record<ObsCommandKind, OperationCode> = {
  prepare: "stream-prepared",
  "go-live": "stream-started",
  pause: "stream-paused",
  resume: "stream-resumed",
  stop: "stream-stopped",
};

/** Persists interaction intent before OBS effects. Connections/readiness never start a broadcast. */
export class ObsWorkflow {
  private state: ObsPublicState = emptyObsState();
  private closed = false;
  private stopObserving = () => {};
  private observed: Promise<void> = Promise.resolve();
  constructor(
    private readonly store: StudioStore,
    private readonly obs: ObsControlPort,
  ) {}
  start(): void {
    this.state.uncertain =
      this.store.obsContext().command?.status === "pending" || this.store.obsContext().command?.status === "uncertain";
    this.stopObserving = this.obs.subscribe((value) => {
      this.observed = this.observed
        .then(() => this.observe(value))
        .catch(() => {
          this.state.lastError = "OBS status could not be recorded. Check vault access.";
          void this.publish();
        });
    });
    void this.publish();
    if (this.settings().autoConnect) void this.connect().catch(() => undefined);
  }
  dispose(): void {
    this.closed = true;
    this.stopObserving();
    this.obs.dispose();
  }
  private settings() {
    return this.store.obsContext().settings;
  }
  private async event(
    code: OperationCode,
    effect: "none" | "committed" | "uncertain" = "committed",
    id?: string,
  ): Promise<void> {
    await this.store.transaction((state) => recordOperation(state, code, effect, undefined, 1, id));
  }
  private async publish(): Promise<void> {
    if (!this.closed) await this.store.updateRuntime({ obs: structuredClone(this.state) });
  }
  private checkOpen(): void {
    if (this.closed) throw new IntegrationFailure("validation", "The OBS workflow is closed. Reopen CoForge.");
  }
  private async claim(): Promise<void> {
    this.checkOpen();
    if (this.state.busy) {
      await this.event("stream-control-rejected", "none");
      throw new IntegrationFailure("validation", "An OBS interaction is already in progress.");
    }
    this.state.busy = true;
  }
  async configure(input: unknown): Promise<void> {
    await this.claim();
    try {
      await this.event("obs-settings-save-requested", "none");
      const prior = this.settings();
      const next = obsSettingsCheck({ ...prior, ...record(input) });
      if (this.state.onBreak && prior.breakSceneId !== next.breakSceneId)
        throw new IntegrationFailure("validation", "Resume before changing the BRB scene.");
      await this.store.transaction((state) => {
        state.obsSettings = next;
        recordOperation(state, "obs-settings-saved");
      });
      this.state.prepared = false;
      if (prior.endpoint !== next.endpoint) {
        this.obs.disconnect();
        this.state.connection = "disconnected";
        delete this.state.snapshot;
      }
      await this.publish();
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
  async setPassword(value: string): Promise<void> {
    await this.claim();
    try {
      await this.event("obs-password-save-requested", "none");
      if (!value || value.length > 1000)
        throw new IntegrationFailure("validation", "Enter the OBS WebSocket password, up to 1,000 characters.");
      await this.obs.savePassword(this.settings().passwordSecret, value);
      await this.event("obs-password-saved");
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
  async connect(): Promise<void> {
    await this.claim();
    this.state.busy = true;
    delete this.state.lastError;
    try {
      await this.event("obs-connect-requested", "none");
      this.state.connection = "connecting";
      await this.publish();
      await this.accept(await this.obs.connect(this.settings()));
      this.state.connection = "connected";
      await this.event("obs-connected");
      await this.reconcile();
    } catch (error) {
      this.state.connection = "error";
      this.state.lastError = error instanceof IntegrationFailure ? error.message : "OBS could not be connected.";
      throw error;
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
  async open(): Promise<void> {
    await this.claim();
    delete this.state.lastError;
    try {
      await this.event("obs-open-requested", "none");
      this.state.connection = "connecting";
      await this.publish();
      await this.accept(await this.obs.open(this.settings()));
      delete this.state.lastError;
      await this.event("obs-opened");
      await this.reconcile();
    } catch (error) {
      this.state.lastError =
        error instanceof IntegrationFailure
          ? error.message
          : "OBS could not be opened. Check its installation and WebSocket setup.";
      this.state.connection = "error";
      this.state.prepared = false;
      await this.event("obs-open-failed", "none");
      throw new IntegrationFailure("service", this.state.lastError);
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
  async disconnect(): Promise<void> {
    await this.claim();
    try {
      await this.event("obs-disconnect-requested", "none");
      this.obs.disconnect();
      this.state.connection = "disconnected";
      this.state.prepared = false;
      await this.event("obs-disconnected");
      await this.publish();
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
  async refresh(): Promise<void> {
    await this.claim();
    this.state.busy = true;
    try {
      await this.event("obs-refresh-requested", "none");
      await this.accept(await this.obs.snapshot());
      await this.reconcile();
      await this.event("obs-refreshed");
      delete this.state.lastError;
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
  private async reconcile(): Promise<void> {
    this.state.uncertain = false;
    await this.store.transaction((state) => {
      if (state.obsCommand && ["pending", "uncertain"].includes(state.obsCommand.status))
        state.obsCommand.status = "reconciled";
    });
  }
  private async accept(snapshot: ObsSnapshot): Promise<void> {
    if (this.closed) return;
    const previous = this.state.snapshot;
    if (
      previous &&
      (snapshot.epoch < previous.epoch || (snapshot.epoch === previous.epoch && snapshot.revision < previous.revision))
    )
      return;
    this.state.snapshot = structuredClone(snapshot);
    this.state.connection = "connected";
    this.state.onBreak =
      snapshot.active &&
      Boolean(this.settings().breakSceneId) &&
      snapshot.programSceneId === this.settings().breakSceneId;
    if (snapshot.active || !snapshot.scenes.some((scene) => scene.id === this.settings().liveSceneId))
      this.state.prepared = false;
    await this.publish();
    if (previous && previous.programSceneId !== snapshot.programSceneId) await this.event("obs-scene-changed");
    if (previous && (previous.active !== snapshot.active || previous.reconnecting !== snapshot.reconnecting))
      await this.event("obs-stream-state-changed");
  }
  private async observe(value: ObsObservation): Promise<void> {
    if (this.closed) return;
    const previous = this.state.connection;
    this.state.connection = value.connection;
    if (value.connection === "connected" && !this.state.uncertain) delete this.state.lastError;
    if (value.snapshot && value.connection === "connected") await this.accept(value.snapshot);
    else if (value.connection !== "connected") {
      this.state.prepared = false;
      if (value.error) this.state.lastError = value.error;
    }
    if (previous === "connected" && value.connection !== "connected") await this.event("obs-disconnected", "none");
    await this.publish();
    if (previous !== value.connection) await this.event("obs-connection-changed", "none");
  }
  private async fresh(): Promise<ObsSnapshot> {
    if (this.state.connection !== "connected")
      throw new IntegrationFailure("validation", "Connect OBS before controlling the stream.");
    const snapshot = await this.obs.snapshot();
    await this.accept(snapshot);
    return snapshot;
  }
  prepare(): Promise<void> {
    return this.command("prepare");
  }
  goLive(): Promise<void> {
    return this.command("go-live");
  }
  pause(): Promise<void> {
    return this.command("pause");
  }
  resume(): Promise<void> {
    return this.command("resume");
  }
  stop(): Promise<void> {
    return this.command("stop");
  }
  private async command(kind: ObsCommandKind): Promise<void> {
    await this.claim();
    if (this.state.uncertain) {
      this.state.busy = false;
      await this.event("stream-control-rejected", "none");
      throw new IntegrationFailure("uncertain", "Refresh OBS status to resolve the previous unconfirmed interaction.");
    }
    this.state.busy = true;
    delete this.state.lastError;
    const id = crypto.randomUUID();
    let recorded = false;
    try {
      await this.store.transaction((state) => {
        state.obsCommand = { id, kind, at: new Date().toISOString(), status: "pending" };
        recordOperation(state, requested[kind], "none", undefined, 1, id);
      });
      recorded = true;
      await this.publish();
      const context = {
        prepared: this.state.prepared,
        resumeSceneId: this.store.obsContext().resumeSceneId,
        rememberResumeScene: async (sceneId: string) => {
          await this.store.transaction((state) => {
            state.obsResumeSceneId = sceneId;
          });
        },
      };
      if (kind !== "prepare") this.state.prepared = false;
      const result = await executeObsCommand(kind, this.obs, this.settings(), context, () => this.fresh());
      await this.accept(result.snapshot);
      if (kind === "prepare") this.state.prepared = true;
      await this.store.transaction((state) => {
        if (state.obsCommand?.id === id) state.obsCommand.status = "confirmed";
        if (result.resumeSceneId) state.obsResumeSceneId = result.resumeSceneId;
        if (kind === "stop" || kind === "resume") delete state.obsResumeSceneId;
        recordOperation(state, confirmed[kind], "committed", undefined, 1, id);
      });
    } catch (error) {
      const uncertain = recorded && (!(error instanceof IntegrationFailure) || error.kind === "uncertain");
      this.state.uncertain = uncertain;
      this.state.lastError =
        error instanceof IntegrationFailure
          ? error.message
          : recorded
            ? "The OBS interaction was not confirmed. Refresh its status."
            : "The interaction could not be saved. No OBS mutation was requested.";
      if (recorded)
        try {
          await this.store.transaction((state) => {
            if (state.obsCommand?.id === id) state.obsCommand.status = uncertain ? "uncertain" : "failed";
            recordOperation(
              state,
              uncertain
                ? "stream-control-uncertain"
                : error instanceof IntegrationFailure && error.kind === "validation"
                  ? "stream-control-rejected"
                  : "stream-control-failed",
              uncertain ? "uncertain" : "none",
              undefined,
              1,
              id,
            );
          });
        } catch {
          /* Pending intent remains authoritative; never replay the OBS mutation. */
        }
      throw new IntegrationFailure(uncertain ? "uncertain" : "validation", this.state.lastError);
    } finally {
      this.state.busy = false;
      await this.publish();
    }
  }
}
