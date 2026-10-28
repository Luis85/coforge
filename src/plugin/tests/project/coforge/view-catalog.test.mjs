import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCatalogue, validateCatalogue, renderSitemap, sourceCoverage } from "../../../../../tooling/coforge/view-catalog.mjs";

const root = process.cwd();
const sample = (id, parent = null) => ({
  id, title: id, goal: "Complete one task.", audience: "streamer", kind: "page",
  route: id, parent, component: "BRIEF.md", entry: ["Studio navigation"],
  actions: ["Review"], states: ["Empty"], journeys: ["setup"],
  privacy: "Private", body: "## Purpose\nComplete one task.", file: `${id}.md`,
});

describe("view catalogue", () => {
  it("rejects duplicate IDs, missing parents, cycles and incomplete task contracts", () => {
    expect(() => validateCatalogue([sample("a"), sample("a")], root)).toThrow(/Duplicate/);
    expect(() => validateCatalogue([sample("a", "absent")], root)).toThrow(/parent/);
    expect(() => validateCatalogue([sample("a", "b"), sample("b", "a")], root)).toThrow(/cycle/);
    expect(() => validateCatalogue([{ ...sample("a"), goal: "" }], root)).toThrow(/goal/);
    expect(() => validateCatalogue([{ ...sample("a"), component: "absent.vue" }], root)).toThrow(/component/);
    expect(() => validateCatalogue([sample("a"), { ...sample("b"), route: "a" }], root)).toThrow(/Duplicate route/);
    expect(() => validateCatalogue([{ ...sample("a"), parent: {} }], root)).toThrow(/parent/);
    expect(() => validateCatalogue([{ ...sample("a"), body: "## Purpose\n[Broken](missing.md)" }], root)).toThrow(/broken local Markdown link/);
    expect(() => validateCatalogue([{ ...sample("a"), body: "## Purpose\n[Source](../../../BRIEF.md)" }], root)).not.toThrow();
    expect(() => validateCatalogue([{ ...sample("a"), component: "../outside.md" }], root)).toThrow(/inside the project/);
  });

  it("documents every live route and nested navigation state exactly once", () => {
    const views = readCatalogue(root);
    expect(views.length).toBeGreaterThan(40);
    expect(() => validateCatalogue(views, root)).not.toThrow();
    expect(() => sourceCoverage(views, root)).not.toThrow();
    const board = views.find((view) => view.id === "board");
    expect(() => sourceCoverage(views.filter((view) => view !== board), root)).toThrow(/board/);
    expect(() => sourceCoverage([...views, { ...board, id: "board-copy" }], root)).toThrow(/coverage/);
    expect(() => sourceCoverage(views.map((view) => view.id === "broadcast-music" ? { ...view, coverage: undefined } : view), root)).toThrow(/music/);
    expect(() => sourceCoverage([...views, { ...board, id: "stale", coverage: { group: "studio", key: "retired" } }], root)).toThrow(/retired/);
  });

  it("keeps generated Markdown and JSON in sync with canonical files", () => {
    const views = readCatalogue(root);
    const output = renderSitemap(views);
    expect(readFileSync(resolve(root, "docs/components/sitemap.md"), "utf8")).toBe(output.markdown);
    expect(readFileSync(resolve(root, "docs/components/sitemap.json"), "utf8")).toBe(output.json);
    expect(output.markdown).toContain("[Request board](views/board.md)");
    expect(renderSitemap([...views].reverse())).toEqual(output);
  });
});
