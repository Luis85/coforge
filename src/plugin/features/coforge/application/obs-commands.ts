import type { ObsControlPort } from "./obs-port";
import type { ObsCommandKind, ObsSettings, ObsSnapshot } from "../domain/obs";
import { IntegrationFailure } from "../domain/integration-failure";
export interface ObsCommandResult {
  snapshot: ObsSnapshot;
  resumeSceneId?: string;
}
function scene(snapshot: ObsSnapshot, id: string, label: string): string {
  if (!id || !snapshot.scenes.some((scene) => scene.id === id))
    throw new IntegrationFailure("validation", `Choose an available ${label} scene and save the OBS settings.`);
  return id;
}
/** Explicit stream commands only. No toggle, recording-pause or reconnect-triggered mutation. */
export async function executeObsCommand(
  kind: ObsCommandKind,
  obs: ObsControlPort,
  settings: ObsSettings,
  context: { prepared: boolean; resumeSceneId?: string; rememberResumeScene(id: string): Promise<void> },
  fresh: () => Promise<ObsSnapshot>,
): Promise<ObsCommandResult> {
  if (kind === "go-live" && !context.prepared)
    throw new IntegrationFailure("validation", "Prepare the stream before going live.");
  let snapshot = await fresh();
  if (kind === "prepare" || kind === "go-live") {
    if (snapshot.active || snapshot.transitioning)
      throw new IntegrationFailure(
        "validation",
        "OBS is already broadcasting or changing state. No second start was sent.",
      );
    const target = scene(snapshot, settings.liveSceneId, "go-live");
    if (settings.breakSceneId) scene(snapshot, settings.breakSceneId, "BRB");
    if (kind === "prepare") return { snapshot };
    if (snapshot.programSceneId !== target) snapshot = await obs.selectScene(target);
    snapshot = await obs.startStream();
    if (!snapshot.active)
      throw new IntegrationFailure(
        "uncertain",
        "OBS did not confirm a live stream. Refresh its status before another action.",
      );
    return { snapshot };
  }
  if (kind === "stop") {
    if (!snapshot.active) throw new IntegrationFailure("validation", "OBS is already off air.");
    const stopped = await obs.stopStream();
    if (stopped.active)
      throw new IntegrationFailure("uncertain", "OBS did not confirm that broadcasting stopped. Refresh its status.");
    return { snapshot: stopped };
  }
  if (!snapshot.active || snapshot.reconnecting || snapshot.transitioning)
    throw new IntegrationFailure("validation", "OBS must be live and stable before this stream interaction.");
  if (kind === "pause") {
    if (!snapshot.programSceneId)
      throw new IntegrationFailure(
        "validation",
        "Refresh OBS to identify the current program scene before taking a break.",
      );
    const target = scene(snapshot, settings.breakSceneId, "BRB");
    if (snapshot.programSceneId === target)
      throw new IntegrationFailure("validation", "OBS is already on the BRB scene.");
    await context.rememberResumeScene(snapshot.programSceneId);
    const after = await obs.selectScene(target);
    if (!after.active || after.programSceneId !== target)
      throw new IntegrationFailure("uncertain", "OBS did not confirm a live BRB scene. Refresh its status.");
    return { snapshot: after, resumeSceneId: snapshot.programSceneId ?? settings.liveSceneId };
  }
  if (kind === "resume") {
    if (snapshot.programSceneId !== settings.breakSceneId)
      throw new IntegrationFailure("validation", "OBS is not on the configured BRB scene.");
    const target = scene(snapshot, context.resumeSceneId || settings.liveSceneId, "resume");
    const after = await obs.selectScene(target);
    if (!after.active || after.programSceneId !== target)
      throw new IntegrationFailure("uncertain", "OBS did not confirm the resumed live scene. Refresh its status.");
    return { snapshot: after };
  }
  throw new IntegrationFailure("validation", "Unsupported OBS interaction.");
}
