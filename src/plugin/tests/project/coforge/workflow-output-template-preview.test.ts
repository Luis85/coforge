import { expect, it } from "vitest";
import { createOutputTemplatesPreview } from "../../../../../harness/prototype/output-templates-preview";

it("keeps temporary template CRUD project scoped, conflict checked and independent from returned objects", async () => {
  const preview = createOutputTemplatesPreview((id) => {
    if (!["CFP-001", "CFP-002"].includes(id))
      throw new Error("Project unavailable");
  });
  const created = await preview.save("CFP-001", {
    name: "Answer",
    markdown: "# Answer\n",
  });
  expect((await preview.list("CFP-002")).templates).toEqual([]);
  created.markdown = "Changed caller object";
  const saved = (await preview.list("CFP-001")).templates[0];
  if (!saved) throw new Error("Saved template missing");
  expect(saved.markdown).toBe("# Answer\n");
  await expect(
    preview.save(
      "CFP-002",
      { id: saved.id, name: "Other", markdown: "No" },
      saved.revision,
    ),
  ).rejects.toThrow();
  const edited = await preview.save(
    "CFP-001",
    { id: saved.id, name: "Evidence", markdown: "## Evidence\n" },
    saved.revision,
  );
  await expect(
    preview.save(
      "CFP-001",
      { id: saved.id, name: "Stale", markdown: "No" },
      saved.revision,
    ),
  ).rejects.toThrow(/changed/u);
  await expect(
    preview.remove("CFP-001", saved.id, saved.revision),
  ).rejects.toThrow(/changed/u);
  expect((await preview.list("CFP-001")).templates).toEqual([edited]);
  await preview.remove("CFP-001", edited.id, edited.revision);
  expect((await preview.list("CFP-001")).templates).toEqual([]);
  await expect(preview.open("CFP-001", edited.id)).rejects.toThrow(/Obsidian/u);
  await expect(preview.list("unavailable")).rejects.toThrow(/unavailable/u);
});
