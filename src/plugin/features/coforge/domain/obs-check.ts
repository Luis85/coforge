import { boolean, oneOf, optional, shape, text, timestamp } from "./check";
import type { ObsSettings } from "./obs";
import { OBS_SCENE_KINDS } from './obs-scenes';
const settings = shape(
  {
    endpoint: text({ trim: true, min: 1, max: 500 }),
    executable: optional(text({ trim: true, max: 1000 })),
    passwordSecret: text({ min: 1, max: 64, pattern: /^[a-z0-9-]+$/ }),
    autoConnect: boolean,
    liveSceneId: text({ max: 300 }),
    breakSceneId: text({ max: 300 }),
  },
  { strict: true },
);
export function obsSettingsCheck(value: unknown): ObsSettings {
  const input = settings(value);
  let url: URL;
  try {
    url = new URL(input.endpoint);
  } catch {
    throw new Error("Enter an OBS WebSocket URL such as ws://127.0.0.1:4455.");
  }
  if (
    !["ws:", "wss:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use a ws:// or wss:// OBS URL without credentials, query parameters or fragments.");
  if (input.liveSceneId && input.liveSceneId === input.breakSceneId)
    throw new Error("Choose different go-live and BRB scenes.");
  return { ...input, executable: input.executable ?? "", endpoint: url.href };
}
export const obsCommandCheck = shape({
  id: text({ min: 1, max: 100 }),
  kind: oneOf(["prepare", "go-live", "pause", "resume", "stop", "production", ...OBS_SCENE_KINDS] as const),
  at: timestamp,
  status: oneOf(["pending", "confirmed", "failed", "uncertain", "reconciled"] as const),
});
