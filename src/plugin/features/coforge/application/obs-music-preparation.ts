import type { ScheduledStream } from "../domain/schedule";
import type { ObsProductionSnapshot } from "../domain/obs-production";
import { obsMediaInputKind } from "../domain/obs-production";
import type { ObsSceneActions } from "../domain/obs-scenes";

/** Adds existing music sources disabled. OBS owns playback; no file or playlist is loaded here. */
export class ObsMusicPreparation {
  constructor(
    private readonly production: {
      inspect(): Promise<
        Pick<ObsProductionSnapshot, "broadcast" | "context"> & {
          inputs: Array<{ id: string; kind: string }>;
        }
      >;
    },
    private readonly scenes: ObsSceneActions,
  ) {}
  async prepare(plan: ScheduledStream): Promise<void> {
    const assignments = [
      { sceneId: plan.liveSceneId, inputId: plan.music?.liveInputId },
      { sceneId: plan.breakSceneId, inputId: plan.music?.breakInputId },
    ].filter((value) => value.inputId);
    if (!assignments.length)
      throw new Error(
        "Choose an existing OBS music source for a planned scene first.",
      );
    const before = await this.production.inspect();
    const validate = (current: typeof before) => {
      if (
        current.broadcast.active ||
        current.broadcast.reconnecting ||
        current.broadcast.transitioning
      )
        throw new Error(
          "Connect OBS and stop the stream before preparing music sources.",
        );
      if (
        current.context.epoch !== before.context.epoch ||
        current.context.collection !== before.context.collection
      )
        throw new Error(
          "The OBS connection or scene collection changed. Refresh and review the music assignments.",
        );
      for (const assignment of assignments) {
        if (
          !current.broadcast.scenes.some(
            (scene) => scene.id === assignment.sceneId,
          )
        )
          throw new Error(
            "Choose an available scene for every music assignment.",
          );
        if (
          !current.inputs.some(
            (input) =>
              input.id === assignment.inputId && obsMediaInputKind(input.kind),
          )
        )
          throw new Error(
            "Choose an available OBS media source for each music assignment.",
          );
      }
    };
    validate(before);
    // Preflight every scene before making a partial update; each mutation still uses its fresh context.
    for (const assignment of assignments) {
      const detail = await this.scenes.inspect(assignment.sceneId);
      if (
        !detail.items.some(
          (item) => item.sourceId === `input:${assignment.inputId}`,
        ) &&
        !detail.available.includes("item-add")
      )
        throw new Error(
          "This OBS scene does not support adding an existing music source.",
        );
    }
    for (const assignment of assignments) {
      validate(await this.production.inspect());
      const detail = await this.scenes.inspect(assignment.sceneId);
      if (
        detail.context.epoch !== before.context.epoch ||
        detail.context.collection !== before.context.collection
      )
        throw new Error(
          "The OBS scene collection changed. Refresh and review the music assignments.",
        );
      if (
        detail.items.some(
          (item) => item.sourceId === `input:${assignment.inputId}`,
        )
      )
        continue;
      await this.scenes.execute({
        kind: "item-add",
        sceneId: assignment.sceneId,
        sourceId: `input:${assignment.inputId}`,
        enabled: false,
        expected: detail.context,
      });
    }
  }
}
