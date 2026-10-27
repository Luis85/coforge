import type { ObsControlPort } from "../../features/coforge/application/obs-port";
import type { Timers } from "../../features/coforge/application/ports";
import type {
  ObsObservation,
  ObsSettings,
  ObsSnapshot,
  ObsScene,
  ObsInstallation,
} from "../../features/coforge/domain/obs";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
import { record } from "../../features/coforge/domain/check";
import { ObsClient, type ObsSocket } from "./obs-client";
import type { TwitchSecrets } from "./twitch-auth";
import { launchObs, detectObs } from "./obs-launch";
import type { ObsMetrics } from '../../features/coforge/domain/stream-metrics';

const REQUIRED = ["GetSceneList", "GetStreamStatus", "SetCurrentProgramScene", "StartStream", "StopStream"];
/** Only stream/status/scene requests are exposed. Stream-service keys and output credentials are never read. */
export class ObsAdapter implements ObsControlPort {
  private readonly client: ObsClient;
  private readonly listeners = new Set<(value: ObsObservation) => void>();
  private revision = 0;
  private current: ObsObservation = { connection: "disconnected" };
  private refreshing = false;
  private dirty = false;
  private transition = false;
  private closed = false;
  private readonly launchAbort = new AbortController();
  private monitor: number | undefined;
  private readonly waits = new Map<number, () => void>();
  constructor(
    socket: (url: string) => ObsSocket,
    private readonly timers: Timers,
    private readonly secrets: TwitchSecrets,
    private readonly launch: (executable: string, signal?: AbortSignal) => Promise<void> = (executable, signal) =>
      launchObs(executable, undefined, signal),
    private readonly detectTool: (executable: string) => Promise<ObsInstallation> = detectObs,
  ) {
    this.client = new ObsClient(
      socket,
      timers,
      (key) => secrets.getSecret(key),
      (connection, error) => {
        // Events from the prior socket cannot describe a transition after reconnect.
        if (connection === "connected") this.transition = false;
        if (connection === "connected" && this.monitor === undefined)
          this.monitor = timers.setInterval(() => this.refreshSoon(), 15000);
        else if (connection !== "connected" && this.monitor !== undefined) {
          timers.clearInterval(this.monitor);
          this.monitor = undefined;
        }
        this.notify({
          connection,
          ...(this.current.snapshot ? { snapshot: this.current.snapshot } : {}),
          ...(error ? { error } : {}),
        });
        if (connection === "connected") this.refreshSoon();
      },
      (type, data) => {
        if (type === "StreamStateChanged")
          this.transition =
            data.outputState === "OBS_WEBSOCKET_OUTPUT_STARTING" ||
            data.outputState === "OBS_WEBSOCKET_OUTPUT_STOPPING";
        if (
          [
            "StreamStateChanged",
            "CurrentProgramSceneChanged",
            "SceneListChanged",
            "SceneNameChanged",
            "CurrentSceneCollectionChanged",
            "ExitStarted",
          ].includes(type)
        )
          this.refreshSoon();
      },
    );
  }
  subscribe(listener: (value: ObsObservation) => void): () => void {
    this.listeners.add(listener);
    listener(structuredClone(this.current));
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify(value: ObsObservation): void {
    if (this.closed) return;
    this.current = value;
    for (const listener of this.listeners)
      try {
        listener(structuredClone(value));
      } catch {
        /* Observer does not control protocol ownership. */
      }
  }
  async connect(settings: ObsSettings): Promise<ObsSnapshot> {
    this.transition = false;
    await this.client.connect(settings.endpoint, settings.passwordSecret);
    return this.verifiedSnapshot();
  }
  async detect(settings: ObsSettings): Promise<ObsInstallation> {
    try {
      const passwordSaved = Boolean(this.secrets.getSecret(settings.passwordSecret));
      if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(settings.endpoint).hostname))
        return { status: "remote", running: false, passwordSaved };
      return { ...(await this.detectTool(settings.executable)), passwordSaved };
    } catch (error) {
      if (error instanceof IntegrationFailure) throw error;
      throw new IntegrationFailure(
        "service",
        "OBS detection could not be completed. Check its path and Obsidian secret storage.",
      );
    }
  }
  private async verifiedSnapshot(): Promise<ObsSnapshot> {
    const version = await this.client.request("GetVersion");
    const available = version.availableRequests;
    if (!Array.isArray(available) || REQUIRED.some((type) => !available.includes(type))) {
      this.client.disconnect();
      throw new IntegrationFailure("validation", "This OBS server does not provide the required v5 stream controls.");
    }
    return this.snapshot();
  }
  async open(settings: ObsSettings): Promise<ObsSnapshot> {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(settings.endpoint).hostname))
      throw new IntegrationFailure(
        "validation",
        "Open OBS Studio works with a local WebSocket address. Use Connect OBS for a remote server.",
      );
    try {
      return await this.connect(settings);
    } catch (error) {
      if (!(error instanceof IntegrationFailure) || error.kind !== "service") throw error;
    }
    if (this.closed) throw new IntegrationFailure("service", "The OBS connection was closed.");
    this.client.disconnect();
    await this.launch(settings.executable, this.launchAbort.signal);
    if (this.closed) throw new IntegrationFailure("service", "The OBS connection was closed.");
    return new Promise<ObsSnapshot>((resolve, reject) => {
      let settled = false;
      let checking = false;
      let unsubscribe = () => {};
      const finish = (value?: ObsSnapshot, error?: unknown) => {
        if (settled) return;
        settled = true;
        this.timers.clearTimeout(timer);
        this.waits.delete(timer);
        unsubscribe();
        if (value) resolve(value);
        else {
          this.client.disconnect();
          reject(
            error instanceof IntegrationFailure
              ? error
              : new IntegrationFailure(
                  "service",
                  "OBS opened but could not connect. Enable its WebSocket server, save the password and reconnect.",
                ),
          );
        }
      };
      const timer = this.timers.setTimeout(() => finish(), 30000);
      this.waits.set(timer, () => finish());
      unsubscribe = this.subscribe((value) => {
        if (value.connection === "error")
          finish(
            undefined,
            new IntegrationFailure("authorization", value.error ?? "Check the OBS WebSocket password."),
          );
        if (value.connection !== "connected" || checking || settled) return;
        checking = true;
        void this.verifiedSnapshot().then(
          (value) => finish(value),
          (error) => finish(undefined, error),
        );
      });
      void this.client.connect(settings.endpoint, settings.passwordSecret).catch((error) => {
        if (error instanceof IntegrationFailure && error.kind === "authorization") finish(undefined, error);
      });
    });
  }
  disconnect(): void {
    this.client.disconnect();
  }
  dispose(): void {
    this.closed = true;
    this.launchAbort.abort();
    if (this.monitor !== undefined) this.timers.clearInterval(this.monitor);
    this.monitor = undefined;
    for (const [timer, resolve] of this.waits) {
      this.timers.clearTimeout(timer);
      resolve();
    }
    this.waits.clear();
    this.client.disconnect();
    this.listeners.clear();
  }
  async savePassword(key: string, value: string): Promise<void> {
    try {
      this.secrets.setSecret(key, value);
    } catch {
      throw new IntegrationFailure(
        "authorization",
        "The OBS password could not be stored securely. Check Obsidian secret storage.",
      );
    }
  }
  async snapshot(): Promise<ObsSnapshot> {
    const epoch = this.client.epoch;
    const revision = ++this.revision;
    const [list, stream] = await Promise.all([
      this.client.request("GetSceneList"),
      this.client.request("GetStreamStatus"),
    ]);
    if (!this.client.connected || epoch !== this.client.epoch)
      throw new IntegrationFailure("service", "OBS connection changed while reading its status.");
    if (
      !Array.isArray(list.scenes) ||
      list.scenes.length > 1000 ||
      typeof stream.outputActive !== "boolean" ||
      typeof stream.outputReconnecting !== "boolean"
    )
      throw new IntegrationFailure("service", "OBS returned incomplete scene or stream status.");
    const scenes: ObsScene[] = list.scenes.map((value) => {
      const scene = record(value);
      if (typeof scene.sceneName !== "string" || !scene.sceneName || scene.sceneName.length > 300)
        throw new IntegrationFailure("service", "OBS returned an invalid scene.");
      return {
        id: typeof scene.sceneUuid === "string" && scene.sceneUuid ? scene.sceneUuid : scene.sceneName,
        name: scene.sceneName,
      };
    });
    const current = scenes.find(
      (scene) => scene.id === list.currentProgramSceneUuid || scene.name === list.currentProgramSceneName,
    );
    const snapshot: ObsSnapshot = {
      health: Object.fromEntries(['outputBytes', 'outputDuration', 'outputSkippedFrames', 'outputTotalFrames', 'outputCongestion'].map(key => [key, typeof stream[key] === 'number' && Number.isFinite(stream[key]) && stream[key] >= 0 ? stream[key] : null])),
      epoch,
      revision,
      scenes,
      programSceneId: current?.id ?? null,
      active: stream.outputActive,
      reconnecting: stream.outputReconnecting,
      transitioning: this.transition,
      timecode: typeof stream.outputTimecode === "string" ? stream.outputTimecode.slice(0, 40) : "",
      observedAt: new Date().toISOString(),
    };
    if (
      !this.current.snapshot ||
      epoch > this.current.snapshot.epoch ||
      (epoch === this.current.snapshot.epoch && revision >= this.current.snapshot.revision)
    )
      this.notify({ connection: "connected", snapshot });
    return snapshot;
  }
  private refreshSoon(): void {
    if (this.closed || !this.client.connected) return;
    if (this.refreshing) {
      this.dirty = true;
      return;
    }
    this.refreshing = true;
    void this.snapshot()
      .catch(() => undefined)
      .finally(() => {
        this.refreshing = false;
        if (this.dirty) {
          this.dirty = false;
          this.refreshSoon();
        }
      });
  }
  async metrics(): Promise<ObsMetrics> {
    const unavailable: ObsMetrics = { state: 'unavailable', startedAt: null, scene: null, health: {} };
    if (this.closed || !this.client.connected) return unavailable;
    try {
      const snapshot = await this.snapshot();
      const health = { ...snapshot.health };
      const stats = await this.client.request('GetStats').catch(() => ({}));
      for (const key of ['cpuUsage', 'memoryUsage', 'availableDiskSpace', 'activeFps', 'averageFrameRenderTime', 'renderSkippedFrames', 'renderTotalFrames', 'outputSkippedFrames', 'outputTotalFrames']) {
        const value = Reflect.get(stats, key);
        health['stats_' + key] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
      }
      if (this.closed || !this.client.connected || snapshot.epoch !== this.client.epoch) return unavailable;
      const duration = snapshot.health?.outputDuration;
      return { state: snapshot.active ? 'live' : 'offline', startedAt: snapshot.active && typeof duration === 'number' ? new Date(Date.parse(snapshot.observedAt) - duration).toISOString() : null,
        scene: snapshot.scenes.find(scene => scene.id === snapshot.programSceneId)?.name ?? null, health };
    } catch { return unavailable; }
  }
  async selectScene(id: string): Promise<ObsSnapshot> {
    const before = await this.snapshot();
    const scene = before.scenes.find((scene) => scene.id === id);
    if (!scene)
      throw new IntegrationFailure("validation", "The selected OBS scene is no longer available. Refresh scenes.");
    await this.client.request("SetCurrentProgramScene", { sceneName: scene.name });
    let after: ObsSnapshot;
    try {
      after = await this.snapshot();
    } catch {
      throw new IntegrationFailure(
        "uncertain",
        "OBS accepted the scene switch but its state could not be read. Refresh its status.",
      );
    }
    if (after.programSceneId !== id)
      throw new IntegrationFailure("uncertain", "OBS did not confirm the selected program scene. Refresh its status.");
    return after;
  }
  async startStream(): Promise<ObsSnapshot> {
    await this.client.request("StartStream");
    return this.waitFor(true);
  }
  async stopStream(): Promise<ObsSnapshot> {
    await this.client.request("StopStream");
    return this.waitFor(false);
  }
  private async waitFor(active: boolean): Promise<ObsSnapshot> {
    const deadline = Date.now() + 15000;
    while (!this.closed && Date.now() < deadline) {
      try {
        const snapshot = await this.snapshot();
        if (snapshot.active === active && !snapshot.transitioning) return snapshot;
      } catch {
        throw new IntegrationFailure(
          "uncertain",
          "OBS did not confirm the broadcast state. Refresh before another stream action.",
        );
      }
      await new Promise<void>((resolve) => {
        const timer = this.timers.setTimeout(() => {
          this.waits.delete(timer);
          resolve();
        }, 250);
        this.waits.set(timer, resolve);
      });
    }
    throw new IntegrationFailure("uncertain", "OBS is still changing state. Refresh it before another stream action.");
  }
}
