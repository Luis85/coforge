import type { StudioStore } from "./studio-store";
import type { ObsScenePort } from "./obs-scene-port";
import type { ObsSnapshot } from "../domain/obs";
import { obsSceneAction } from "../domain/obs-scenes-check";
import {
  sceneContext,
  type ObsSceneKind,
  type ObsSceneResult,
} from "../domain/obs-scenes";
import { IntegrationFailure } from "../domain/integration-failure";
import { recordOperation } from "./population";

export interface ObsSceneGate {
  claim(): Promise<void>;
  release(): Promise<void>;
  fresh(): Promise<ObsSnapshot>;
  accept(snapshot: ObsSnapshot): Promise<void>;
  uncertain(): boolean;
  invalidate(): void | Promise<void>;
  failed(message: string, uncertain: boolean): void;
}
/** Shares admission/recovery with broadcast commands. Scene names and source data never enter operation metadata. */
export class ObsSceneWorkflow {
  constructor(
    private readonly store: StudioStore,
    private readonly port: ObsScenePort,
    private readonly gate: ObsSceneGate,
  ) {}
  async inspect(sceneId: string) {
    await this.gate.fresh();
    return this.port.inspect(sceneId);
  }
  async execute(input: unknown): Promise<ObsSceneResult> {
    await this.gate.claim();
    const id = crypto.randomUUID();
    let kind: ObsSceneKind | undefined;
    let recorded = false;
    let started = false;
    try {
      if (this.gate.uncertain())
        throw new IntegrationFailure(
          "uncertain",
          "Refresh OBS state before another scene action. The previous result is unconfirmed.",
        );
      const action = obsSceneAction(input);
      kind = action.kind;
      const before = await this.gate.fresh();
      const context = sceneContext(before);
      if (
        context.epoch !== action.expected.epoch ||
        context.collection !== action.expected.collection ||
        context.revision !== action.expected.revision
      )
        throw new IntegrationFailure(
          "validation",
          "OBS scenes changed. Refresh the scene editor and review the action again.",
        );
      if (before.transitioning || before.reconnecting)
        throw new IntegrationFailure(
          "validation",
          "Wait until OBS is stable before editing scenes.",
        );
      if (action.kind === "scene-delete") {
        const scene = before.scenes.find(
          (scene) => scene.id === action.sceneId,
        );
        const settings = this.store.obsContext();
        if (!action.confirmed || !scene || scene.name !== action.confirmedName)
          throw new IntegrationFailure(
            "validation",
            "Confirm the current scene name before deleting it.",
          );
        if (
          before.scenes.length <= 1 ||
          scene.id === before.programSceneId ||
          scene.id === before.previewSceneId ||
          [
            settings.settings.liveSceneId,
            settings.settings.breakSceneId,
            settings.resumeSceneId,
          ].includes(scene.id)
        )
          throw new IntegrationFailure(
            "validation",
            "This scene is in use or assigned to stream controls. Switch scenes or choose replacement assignments before deleting it.",
          );
      }
      if (action.kind === "item-remove" && !action.confirmed)
        throw new IntegrationFailure(
          "validation",
          "Confirm removal of this source from the scene.",
        );
      await this.store.transaction((state) => {
        state.obsCommand = {
          id,
          kind: action.kind,
          at: new Date().toISOString(),
          status: "pending",
        };
        recordOperation(
          state,
          "obs-scene-action-requested",
          "none",
          undefined,
          1,
          id,
          action.kind,
        );
      });
      recorded = true;
      await this.gate.invalidate();
      started = true;
      const result = await this.port.execute(action);
      if (result.renamed)
        await this.store.transaction((state) => {
          const renamed = result.renamed!;
          if (state.obsSettings?.liveSceneId === renamed.from)
            state.obsSettings.liveSceneId = renamed.to;
          if (state.obsSettings?.breakSceneId === renamed.from)
            state.obsSettings.breakSceneId = renamed.to;
          if (state.obsResumeSceneId === renamed.from)
            state.obsResumeSceneId = renamed.to;
        });
      await this.gate.accept(result.snapshot);
      await this.store.transaction((state) => {
        if (state.obsCommand?.id === id) state.obsCommand.status = "confirmed";
        recordOperation(
          state,
          "obs-scene-action-confirmed",
          "committed",
          undefined,
          1,
          id,
          action.kind,
        );
      });
      return result;
    } catch (error) {
      const unknown =
        error instanceof IntegrationFailure
          ? error.kind === "uncertain"
          : started;
      const message =
        error instanceof IntegrationFailure
          ? error.message
          : started
            ? "The scene change is unconfirmed. Refresh OBS and inspect its current scenes before trying again."
            : "The scene action could not be saved. No OBS mutation was requested.";
      this.gate.failed(message, unknown);
      try {
        await this.store.transaction((state) => {
          if (recorded && state.obsCommand?.id === id)
            state.obsCommand.status = unknown ? "uncertain" : "failed";
          recordOperation(
            state,
            unknown ? "obs-scene-action-uncertain" : "obs-scene-action-failed",
            unknown ? "uncertain" : "none",
            undefined,
            1,
            id,
            kind,
          );
        });
      } catch {
        /* Pending intent remains authoritative. Never replay a scene mutation. */
      }
      throw new IntegrationFailure(
        unknown ? "uncertain" : "validation",
        message,
      );
    } finally {
      await this.gate.release();
    }
  }
}
