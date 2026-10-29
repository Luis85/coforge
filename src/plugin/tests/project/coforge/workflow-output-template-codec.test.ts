// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultWorkflowOutputTemplates } from "../../../infrastructure/coforge/vault-workflow-output-templates";
import { readWorkflowOutputTemplateNote } from "../../../infrastructure/coforge/workflow-output-template-notes";

const config =
  "schema: coforge-output-template/v1, id: answer, projectId: CFP-001, name: Before";
const cases = [
  [
    "indented block metadata",
    '  custom: "keep exact" # owner\n  coforge:\n    schema: coforge-output-template/v1\n    id: answer\n    projectId: CFP-001\n    name: Before\n  after: "keep after" # after',
  ],
  [
    "indented flow metadata",
    `  custom: "keep exact" # owner\n  coforge: { ${config} } # keep metadata comment\n  after: "keep after" # after`,
  ],
  [
    "indented block metadata followed by a standalone comment",
    '  custom: "keep exact" # owner\n  coforge:\n    schema: coforge-output-template/v1\n    id: answer\n    projectId: CFP-001\n    name: Before\n# keep metadata comment\n  after: "keep after" # after',
  ],
] as const;

it.each(cases)(
  "edits valid %s without corrupting the canonical note or unrelated bytes",
  async (_name, yaml) => {
    const app = new App();
    const path = "CoForge/Output Templates/CFP-001/answer.md";
    const original = `---\n${yaml}\n---\n# Original\n`;
    const kit = createTestApp({ app, files: { [path]: original } });
    const plugin = new (class extends Plugin {})(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      author: "",
      description: "",
    });
    const templates = new VaultWorkflowOutputTemplates(
      plugin,
      async () => undefined,
      () => undefined,
    );
    const before = readWorkflowOutputTemplateNote(original);
    const saved = await templates.save(
      "CFP-001",
      { id: "answer", name: "After", markdown: "# Updated\n\nExact body.\n" },
      before.revision,
    );
    expect(readWorkflowOutputTemplateNote(kit.read(path))).toEqual(saved);
    expect(saved.markdown).toBe("# Updated\n\nExact body.\n");
    expect(kit.read(path)).toContain('  custom: "keep exact" # owner\n');
    expect(kit.read(path)).toContain('  after: "keep after" # after\n');
    if (yaml.includes("# keep metadata comment"))
      expect(kit.read(path)).toContain("# keep metadata comment");
    expect((await templates.list("CFP-001")).invalid).toEqual([]);
  },
);

it("leaves a valid root flow mapping byte-identical if its replacement cannot be serialized safely", async () => {
  const app = new App();
  const path = "CoForge/Output Templates/CFP-001/answer.md";
  const original = `---\n{ custom: "keep exact", coforge: { ${config} }, after: "keep after" } # owner\n---\n# Original\n`;
  const kit = createTestApp({ app, files: { [path]: original } });
  const plugin = new (class extends Plugin {})(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const templates = new VaultWorkflowOutputTemplates(
    plugin,
    async () => undefined,
    () => undefined,
  );
  const before = readWorkflowOutputTemplateNote(original);
  await expect(
    templates.save(
      "CFP-001",
      { id: "answer", name: "After", markdown: "# Updated\n" },
      before.revision,
    ),
  ).rejects.toThrow();
  expect(kit.read(path)).toBe(original);
  expect((await templates.list("CFP-001")).templates).toEqual([before]);
});
