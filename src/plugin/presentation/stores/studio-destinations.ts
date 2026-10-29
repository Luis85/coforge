import type { StudioView } from "./coforge-studio";

export type StudioGroup = "stream" | "build" | "community" | "insights";
type Destination = {
  label: string;
  icon: string;
  group: StudioGroup;
  scope: "project" | "channel" | "vault";
  requiresProject?: boolean;
  parent?: StudioView;
};

/** One contract for root destination identity, task ownership and data scope. */
export const STUDIO_DESTINATIONS = {
  broadcast: {
    label: "Stream studio",
    icon: "radio",
    group: "stream",
    scope: "channel",
  },
  schedule: {
    label: "Schedule",
    icon: "calendar-days",
    group: "stream",
    scope: "channel",
  },
  stream: {
    label: "Stream chat",
    icon: "message-square",
    group: "stream",
    scope: "channel",
  },
  board: {
    label: "Idea board",
    icon: "layout-grid",
    group: "build",
    scope: "project",
    requiresProject: true,
  },
  council: {
    label: "The Council",
    icon: "users",
    group: "build",
    scope: "vault",
  },
  coworkers: { label: 'CoWorkers', icon: 'user-round', group: 'build', scope: 'vault' },
  'service-design': { label: 'Service Design', icon: 'workflow', group: 'build', scope: 'project', requiresProject: true },
  workflow: {
    label: "Agent workflow",
    icon: "workflow",
    group: "build",
    scope: "project",
    parent: "settings",
  },
  "workflow-settings": {
    label: "Workflow settings",
    icon: "sliders-horizontal",
    group: "build",
    scope: "project",
    parent: "workflow",
  },
  settings: {
    label: "Project settings",
    icon: "settings",
    group: "build",
    scope: "project",
  },
  community: {
    label: "Community",
    icon: "trophy",
    group: "community",
    scope: "channel",
  },
  population: {
    label: "Viewers",
    icon: "users",
    group: "community",
    scope: "channel",
  },
  economy: {
    label: 'Economy', icon: 'coins', group: 'community', scope: 'channel',
  },
  "community-settings": {
    label: "Community settings",
    icon: "users-round",
    group: "community",
    scope: "channel",
  },
  statistics: {
    label: "Statistics",
    icon: "chart-line",
    group: "insights",
    scope: "channel",
  },
  "ai-costs": {
    label: "AI costs",
    icon: "receipt-text",
    group: "insights",
    scope: "vault",
  },
  finance: {
    label: "Finances",
    icon: "wallet",
    group: "insights",
    scope: "channel",
  },
  operations: {
    label: "Operations",
    icon: "chart-no-axes-combined",
    group: "insights",
    scope: "channel",
  },
  projects: {
    label: "Projects",
    icon: "gamepad-2",
    group: "build",
    scope: "vault",
  },
} satisfies Record<StudioView, Destination>;

export const STUDIO_GROUPS: ReadonlyArray<{ id: StudioGroup; label: string }> =
  [
    { id: "build", label: "Build & Improve" },
    { id: "stream", label: "Stream" },
    { id: "community", label: "Community" },
    { id: "insights", label: "Insights" },
  ];

export function studioDestination(view: StudioView): Destination {
  return STUDIO_DESTINATIONS[view];
}

/** Compatibility locators share the owning root's frame and global navigation item. */
export function studioRoot(view: StudioView): StudioView {
  const parent = studioDestination(view).parent;
  return parent ? studioRoot(parent) : view;
}

/** Projects has its own switcher; focused subpages stay in their owning root. */
function isStudioView(view: string): view is StudioView {
  return Object.hasOwn(STUDIO_DESTINATIONS, view);
}
export const STUDIO_NAVIGATION = Object.entries(STUDIO_DESTINATIONS).flatMap(
  ([view, destination]) =>
    view !== "projects" && isStudioView(view) && !studioDestination(view).parent
      ? [{ view, ...destination }]
      : [],
);
