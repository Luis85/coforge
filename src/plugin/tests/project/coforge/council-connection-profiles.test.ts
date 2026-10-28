import { expect, it } from "vitest";
import {
  agentDefinitionCheck,
  defaultCouncilDefinition,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import { compileCouncil } from "../../../features/coforge/domain/council-protocol";

const agent = (): AgentDefinition => ({
  schema: "agent/v1",
  id: "agent",
  name: "Agent",
  enabled: true,
  role: "Review",
  instructions: "Review.",
  provider: "demo",
  model: "sonnet",
  contextSources: [],
  requestedCapabilities: { project: "none", messaging: false },
});
it("resolves only supported provider profile bindings and preserves unresolved disabled imports", () => {
  expect(agentDefinitionCheck(agent()).connectionProfile).toBeUndefined();
  expect(
    agentDefinitionCheck({ ...agent(), connectionProfile: "simulation" })
      .connectionProfile,
  ).toBe("simulation");
  expect(
    agentDefinitionCheck({
      ...agent(),
      provider: "claude",
      connectionProfile: "local-claude",
    }).connectionProfile,
  ).toBe("local-claude");
  for (const value of [
    { ...agent(), connectionProfile: "missing-profile" },
    { ...agent(), provider: "claude", connectionProfile: "simulation" },
    { ...agent(), provider: "herdr", connectionProfile: "local-claude" },
  ])
    expect(() => agentDefinitionCheck(value)).toThrow(/profile/i);
  const imported = agentDefinitionCheck({
    ...agent(),
    enabled: false,
    connectionProfile: "unknown-portable-profile",
  });
  expect(imported.connectionProfile).toBe("unknown-portable-profile");
  expect(() => agentDefinitionCheck({ ...imported, enabled: true })).toThrow(
    /profile/i,
  );
});
it("rejects enabled unresolved profiles before saving definitions or compiling an executable Council", async () => {
  let writes = 0;
  const catalogue = new CouncilCatalogue({
    scan: async () => ({ valid: [], invalid: [] }),
    open: async () => undefined,
    save: async () => {
      writes++;
    },
  });
  const invalid = { ...agent(), connectionProfile: "missing-profile" };
  await expect(catalogue.save(invalid)).rejects.toThrow(/profile/i);
  expect(writes).toBe(0);
  const team: TeamDefinition = {
    schema: "team/v1",
    id: "team",
    name: "Team",
    enabled: true,
    projectId: "A",
    members: ["agent"],
    pinnedContext: [],
    recentMessages: 10,
    allowedRecipients: [],
  };
  expect(() =>
    compileCouncil(
      defaultCouncilDefinition("council", "Council", team, team.members),
      team,
      [invalid],
    ),
  ).toThrow(/profile/i);
});
