import { expect, it } from "vitest";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import {
  definitionRevision,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";

it("shows named workflow and inbox impacts beside local team dependencies without changing storage", async () => {
  const agent: AgentDefinition = {
    schema: "agent/v1",
    id: "agent",
    name: "Reviewer",
    enabled: true,
    role: "Review",
    instructions: "Review",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  };
  const team: TeamDefinition = {
    schema: "team/v1",
    id: "team",
    name: "Studio team",
    enabled: true,
    projectId: "project",
    members: ["agent"],
    pinnedContext: [],
    recentMessages: 10,
    allowedRecipients: [],
  };
  const values = [agent, team];
  let saves = 0;
  const catalogue = new CouncilCatalogue(
    {
      scan: async () => ({
        valid: values.map((definition) => ({
          definition,
          path: definition.id + ".md",
          revision: definitionRevision(definition),
        })),
        invalid: [],
      }),
      save: async () => {
        saves++;
      },
      open: async () => undefined,
    },
    async () => ({
      complete: true,
      items: [
        {
          kind: "workflow",
          id: "process",
          name: "Lantern / Design review",
          enabled: true,
        },
        {
          kind: "inbox",
          id: "inbox",
          name: "Private/Design inbox",
          enabled: false,
        },
      ],
    }),
  );
  const usage = await catalogue.dependencies("agent");
  expect(usage.complete).toBe(true);
  expect(usage.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "team", name: "Studio team" }),
      expect.objectContaining({
        kind: "workflow",
        name: "Lantern / Design review",
      }),
      expect.objectContaining({ kind: "inbox", enabled: false }),
    ]),
  );
  expect(saves).toBe(0);
});
