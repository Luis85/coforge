import { record } from "../../features/coforge/domain/check";
import type {
  HerdrAgent,
  HerdrPane,
  HerdrWorkspace,
} from "../../features/coforge/domain/herdr";
const string = (value: unknown, fallback = "") =>
  typeof value === "string" && value.length <= 4096 ? value : fallback;
export function herdrId(value: unknown): string {
  const id = string(value);
  if (
    !id ||
    id.startsWith("-") ||
    [...id].some((char) => char.charCodeAt(0) < 32) ||
    id.length > 320
  )
    throw new Error("Herdr returned an invalid identity.");
  return id;
}
export function herdrList(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 2000)
    throw new Error("Herdr returned an invalid list.");
  return value;
}
export function decodeHerdrAgent(value: unknown): HerdrAgent {
  const item = record(value);
  const nativeSession =
    item.agent_session === undefined || item.agent_session === null
      ? ""
      : JSON.stringify(record(item.agent_session));
  return {
    paneId: herdrId(item.pane_id),
    terminalId: herdrId(item.terminal_id),
    workspaceId: herdrId(item.workspace_id),
    agent: string(item.agent, "unknown"),
    name: string(item.name, string(item.agent, "Agent")),
    cwd: string(item.foreground_cwd, string(item.cwd)),
    status: string(item.agent_status, "unknown"),
    ready: item.interactive_ready !== false && item.launch_pending !== true,
    sessionRef: nativeSession,
  };
}
export function decodeHerdrPane(value: unknown): HerdrPane {
  const item = record(value);
  return {
    id: herdrId(item.pane_id),
    terminalId: herdrId(item.terminal_id),
    workspaceId: herdrId(item.workspace_id),
    cwd: string(item.cwd),
    agent: string(item.agent),
  };
}
export function decodeHerdrWorkspace(
  value: unknown,
  panes: HerdrPane[],
): HerdrWorkspace {
  const item = record(value);
  const id = herdrId(item.workspace_id);
  const worktree =
    typeof item.worktree === "object" && item.worktree
      ? record(item.worktree)
      : {};
  return {
    id,
    name: string(item.label, id),
    cwd: string(
      worktree.checkout_path,
      panes.find((pane) => pane.workspaceId === id)?.cwd ?? "",
    ),
  };
}
export function herdrResult(
  output: string,
  type: string,
): Record<string, unknown> {
  const envelope = record(JSON.parse(output));
  const result = record(envelope.result);
  if (envelope.error !== undefined || result.type !== type)
    throw new Error("Herdr returned an unexpected response.");
  return result;
}
