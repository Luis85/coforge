import { describe, expect, it } from "vitest";
import {
  CouncilCatalogue,
  type CouncilCatalogueSnapshot,
  type CouncilCatalogueStorage,
} from "../../../features/coforge/application/council-catalogue";
import {
  agentDefinitionCheck,
  definitionRevision,
  type CouncilDefinitionDocument,
} from "../../../features/coforge/domain/council-definitions";

function fixture() {
  const snapshot: CouncilCatalogueSnapshot = { valid: [], invalid: [] };
  const storage: CouncilCatalogueStorage = {
    scan: async () => structuredClone(snapshot),
    open: async () => undefined,
    save: async (definition: CouncilDefinitionDocument) => {
      snapshot.valid = snapshot.valid.filter(
        (item) => item.definition.id !== definition.id,
      );
      snapshot.valid.push({
        path: `${definition.id}.md`,
        definition: structuredClone(definition),
        revision: definitionRevision(definition),
      });
    },
  };
  return {
    catalogue: new CouncilCatalogue(storage),
    external(definition: CouncilDefinitionDocument) {
      return storage.save(definition);
    },
  };
}
const agent = () =>
  agentDefinitionCheck({
    schema: "agent/v1",
    id: "architect",
    name: "Architect",
    enabled: true,
    role: "Architecture",
    instructions: "Inspect boundaries.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  });

describe("definition catalogue mutations", () => {
  it("marks externally broken references unavailable rather than silently executing a previous valid definition", async () => {
    const { catalogue, external } = fixture();
    await catalogue.save(agent());
    const snapshot = await catalogue.setup("CFP-001");
    const team = snapshot.valid.find(
      (entry) => entry.definition.schema === "team/v1",
    )!.definition;
    if (team.schema !== "team/v1") throw new Error("Expected team.");
    await external({ ...team, members: ["missing-agent"] });
    const current = await catalogue.list();
    expect(current.valid.some((entry) => entry.definition.id === team.id)).toBe(
      false,
    );
    expect(current.invalid).toEqual([
      {
        path: `${team.id}.md`,
        reason: expect.stringMatching(/referenced.*unavailable/i),
      },
    ]);
  });
  it("creates a default team only through explicit setup, creates definitions and protects stale drafts", async () => {
    const { catalogue, external } = fixture();
    expect((await catalogue.list()).valid).toEqual([]);
    await catalogue.setup("CFP-001");
    await catalogue.setup("CFP-001");
    expect((await catalogue.list()).valid).toHaveLength(1);
    const saved = await catalogue.save(agent());
    const revision = saved.valid.find(
      (item) => item.definition.id === "architect",
    )!.revision;
    await external({ ...agent(), instructions: "External change" });
    await expect(
      catalogue.save({ ...agent(), name: "Draft remains" }, revision),
    ).rejects.toThrow(/changed/i);
    expect(
      (await catalogue.list()).valid.find(
        (item) => item.definition.id === "architect",
      )!.definition,
    ).toMatchObject({ instructions: "External change" });
  });
  it("previews import without writes, keeps imported definitions disabled and rejects stale replacement", async () => {
    const { catalogue } = fixture();
    const json = JSON.stringify({
      format: "coforge-definition/v1",
      definition: agent(),
    });
    const preview = await catalogue.previewImport(json);
    expect((await catalogue.list()).valid).toHaveLength(0);
    expect(preview.definition.enabled).toBe(false);
    await catalogue.applyImport(preview);
    expect((await catalogue.list()).valid[0]!.definition.enabled).toBe(false);
    await expect(catalogue.applyImport(preview)).rejects.toThrow(/preview/i);
  });
  it("requires resolving references, prevents archiving dependencies, and duplicates with a fresh identity", async () => {
    const { catalogue } = fixture();
    await catalogue.save(agent());
    const snapshot = await catalogue.setup("CFP-001");
    const owner = snapshot.valid.find(
      (item) => item.definition.schema === "team/v1",
    )!;
    if (owner.definition.schema !== "team/v1")
      throw new Error("Expected team.");
    await expect(
      catalogue.save(
        { ...owner.definition, members: ["missing"] },
        owner.revision,
      ),
    ).rejects.toThrow(/referenced/i);
    await catalogue.save(
      { ...owner.definition, members: ["architect"] },
      owner.revision,
    );
    await expect(
      catalogue.archive("architect", definitionRevision(agent())),
    ).rejects.toThrow(/dependent/i);
    const duplicated = await catalogue.duplicate("architect", "architect-copy");
    expect(
      duplicated.valid.find((item) => item.definition.id === "architect-copy")!
        .definition.enabled,
    ).toBe(false);
  });
});
