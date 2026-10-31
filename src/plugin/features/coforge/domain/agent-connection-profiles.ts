import type { AgentDefinition } from "./council-definitions";

export const AGENT_CONNECTION_PROFILES = [
  { id: 'local-codex', provider: 'codex', label: 'Configured local Codex CLI' },
  {
    id: "simulation",
    provider: "demo",
    label: "Simulation · no external connection",
  },
  {
    id: "local-claude",
    provider: "claude",
    label: "Configured local Claude Code",
  },
] as const;
/** References bind existing integrations; a definition cannot create credentials or substitute an arbitrary profile. */
export function agentConnectionProfileIssue(
  agent: Pick<AgentDefinition, "provider" | "connectionProfile">,
): string {
  if (agent.connectionProfile === undefined) return "";
  if (
    AGENT_CONNECTION_PROFILES.some(
      (profile) =>
        profile.provider === agent.provider &&
        profile.id === agent.connectionProfile,
    )
  )
    return "";
  return "This connection profile is unavailable for the selected provider. Choose an inherited or supported profile before enabling the agent.";
}
