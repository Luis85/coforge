export interface HerdrSettings {
  executable: string;
  session: string;
}
export interface HerdrWorkspace {
  id: string;
  name: string;
  cwd: string;
}
export interface HerdrPane {
  id: string;
  terminalId: string;
  workspaceId: string;
  cwd: string;
  agent: string;
}
export interface HerdrAgent {
  paneId: string;
  terminalId: string;
  workspaceId: string;
  agent: string;
  name: string;
  cwd: string;
  status: string;
  ready: boolean;
  sessionRef: string;
}
export interface HerdrObservation {
  running: boolean;
  compatible: boolean;
  version: string;
  workspaces: HerdrWorkspace[];
  panes: HerdrPane[];
  agents: HerdrAgent[];
}
export interface HerdrRecord {
  id: string;
  kind: "dispatch" | "workspace-create" | "agent-start" | "agent-interrupt";
  session: string;
  at: string;
  status: "pending" | "delivered" | "uncertain" | "reviewed";
  projectId: string;
  ideaId?: string;
  target?: HerdrAgent;
}
export interface HerdrReview {
  ideaId: string;
  projectId: string;
  projectPath: string;
  prompt: string;
  target: HerdrAgent;
  session: string;
}
export interface HerdrState {
  settings: HerdrSettings;
  observation: HerdrObservation | null;
  checkedAt: string | null;
  busy: boolean;
  records: HerdrRecord[];
  error: string;
}
export const emptyHerdr = (): HerdrState => ({
  settings: { executable: "herdr", session: "default" },
  observation: null,
  checkedAt: null,
  busy: false,
  records: [],
  error: "",
});
export const sameHerdrAgent = (a: HerdrAgent, b: HerdrAgent) =>
  ["paneId", "terminalId", "workspaceId", "agent", "sessionRef"].every(
    (key) => Reflect.get(a, key) === Reflect.get(b, key),
  );
export const herdrReady = (agent: HerdrAgent) =>
  agent.ready &&
  ["idle", "done"].includes(agent.status) &&
  agent.agent !== "unknown";
export const HERDR_OPERATION_CODES = [
  "herdr-settings-saved",
  "herdr-refreshed",
  "herdr-action-requested",
  "herdr-action-delivered",
  "herdr-action-uncertain",
  "herdr-action-reviewed",
  "herdr-agent-focused",
] as const;
export type HerdrOperation = (typeof HERDR_OPERATION_CODES)[number];
