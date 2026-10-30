import { list, oneOf, optional, shape, text, timestamp } from "./check";
import { escapeMarkdown } from "./sanitize";
export interface ScheduleMusic { liveInputId: string; breakInputId: string }
export interface ScheduledStream {
  music?: ScheduleMusic;
  id: string;
  name: string;
  startsAt: string;
  timezone: string;
  projectId: string;
  title: string;
  categoryId: string;
  categoryName: string;
  tags: string[];
  language: string;
  liveSceneId: string;
  breakSceneId: string;
  status: "planned" | "completed" | "cancelled";
}
const check = shape(
  {
    music: optional(shape({ liveInputId: text({ max: 300 }), breakInputId: text({ max: 300 }) }, { strict: true })),
    id: text({ min: 1, max: 80, pattern: /^CFS-[a-zA-Z0-9-]+$/ }),
    name: text({ trim: true, min: 1, max: 120 }),
    startsAt: timestamp,
    timezone: text({ min: 1, max: 100 }),
    projectId: text({ max: 80 }),
    title: text({ max: 140 }),
    categoryId: text({ max: 40, pattern: /^\d*$/ }),
    categoryName: text({ max: 120 }),
    tags: list(text({ min: 1, max: 25, pattern: /^[\p{L}\p{N}]+$/u }), {
      max: 10,
    }),
    language: text({ max: 10, pattern: /^(?:[a-z]{2,3}(?:-[A-Z]{2})?)?$/ }),
    liveSceneId: text({ max: 100 }),
    breakSceneId: text({ max: 100 }),
    status: oneOf(["planned", "completed", "cancelled"] as const),
  },
  { strict: true },
);
export function scheduledStream(input: unknown): ScheduledStream {
  const plan = check(input);
  try {
    new Intl.DateTimeFormat("en", { timeZone: plan.timezone }).format(
      new Date(plan.startsAt),
    );
  } catch {
    throw new Error("Choose a valid date and IANA time zone.");
  }
  if (
    new Set(plan.tags.map((tag) => tag.toLowerCase())).size !== plan.tags.length
  )
    throw new Error("Use distinct channel tags.");
  if (plan.liveSceneId && plan.liveSceneId === plan.breakSceneId)
    throw new Error("Choose different live and BRB scenes.");
  return plan;
}
export const scheduleBody = (plan: ScheduledStream): string =>
  `\n# ${escapeMarkdown(plan.name)}\n\n## Topics\n\n## Script\n\n## Storyboard\n\n`;
export interface ScheduleNote {
  plan: ScheduledStream;
  body: string;
  revision: string;
}
export const SCHEDULE_OPERATION_CODES = [
  "schedule-saved",
  "schedule-note-opened",
  "schedule-project-applied",
  "schedule-channel-applied",
  "schedule-scenes-applied",
  "schedule-music-prepared",
] as const;
