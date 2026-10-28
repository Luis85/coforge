/** Local pages retain their view models while the streamer changes tasks. */
export const BROADCAST_PAGES = [
  { id: "live", label: "Broadcast" },
  { id: "setup", label: "Setup" },
  { id: "scenes", label: "Scenes" },
  { id: "music", label: "Music" },
  { id: "displays", label: "Public displays" },
  { id: "history", label: "History" },
] as const;
export type BroadcastPage = (typeof BROADCAST_PAGES)[number]["id"];

export const COUNCIL_PAGES = [
  { id: "definitions", label: "Definitions" },
  { id: "submit", label: "Submit and preflight" },
  { id: "inboxes", label: "Watched inboxes" },
  { id: "monitor", label: "Run monitor" },
  { id: "workflows", label: "Council workflows" },
  { id: "messages", label: "Team messages" },
  { id: "folders", label: "Definition folders" },
] as const;
export type CouncilPage = (typeof COUNCIL_PAGES)[number]["id"];

export const WORKFLOW_PAGES = [
  { id: "runs", label: "Workflow runs" },
  { id: "herdr", label: "Herdr workspaces" },
] as const;
export type WorkflowPage = (typeof WORKFLOW_PAGES)[number]["id"];

export const STREAM_PAGES = [
  { id: "channel", label: "Chat" },
  { id: "connection", label: "Twitch settings" },
  { id: "messages", label: "Bot messages" },
] as const;
export type StreamPage = (typeof STREAM_PAGES)[number]["id"];
