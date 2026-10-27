import type { SchedulePreparation } from "./schedule-ports";
import type { ScheduledStream } from "../domain/schedule";
import type { TwitchActions } from "../domain/twitch";
import type { ObsActions } from "../domain/obs";
import type { MusicActions } from "./music-ports";
import type { StudioService } from "./studio";
/** Explicit, independent preparation capabilities. This interface has no broadcast-start or audio-play operation. */
export class StreamPlanPreparation implements SchedulePreparation {
  constructor(
    private readonly studio: Pick<
      StudioService,
      "state" | "store" | "selectProject"
    >,
    private readonly twitch: Pick<TwitchActions, "updateChannel">,
    private readonly obs: Pick<ObsActions, "configure">,
    private readonly music: Pick<MusicActions, "selectPlaylist">,
  ) {}
  project(plan: ScheduledStream): Promise<void> {
    return this.studio.selectProject(plan.projectId);
  }
  async channel(plan: ScheduledStream): Promise<void> {
    if (!plan.title || !plan.categoryId || !plan.language)
      throw new Error(
        "Set a title, category and language before updating Twitch.",
      );
    await this.twitch.updateChannel({
      title: plan.title,
      categoryId: plan.categoryId,
      tags: plan.tags,
      language: plan.language,
    });
  }
  async scenes(plan: ScheduledStream): Promise<void> {
    const observation = this.studio.state().runtime.obs;
    if (
      observation?.connection !== "connected" ||
      observation.snapshot?.active ||
      observation.uncertain
    )
      throw new Error(
        "Connect OBS and stop the stream before applying planned scene assignments.",
      );
    const scenes = observation.snapshot?.scenes ?? [];
    if (
      !plan.liveSceneId ||
      !plan.breakSceneId ||
      ![plan.liveSceneId, plan.breakSceneId].every((id) =>
        scenes.some((scene) => scene.id === id),
      )
    )
      throw new Error(
        "Choose available live and BRB scenes. Refresh OBS if they changed.",
      );
    await this.obs.configure({
      ...this.studio.store.obsContext().settings,
      liveSceneId: plan.liveSceneId,
      breakSceneId: plan.breakSceneId,
    });
  }
  async playlist(plan: ScheduledStream): Promise<void> {
    if (!this.music.selectPlaylist)
      throw new Error(
        "Playlist preparation is unavailable. Update CoForge and refresh the music library.",
      );
    await this.music.selectPlaylist(plan.playlistId);
  }
}
