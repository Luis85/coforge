import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCatalogue, validateCatalogue, renderSitemap, sourceCoverage } from "../../../../../tooling/coforge/view-catalog.mjs";

const root = process.cwd();
const catalogue = readCatalogue(root);
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

  it('validates all canonical view contracts', () => {
    expect(() => validateCatalogue(catalogue, root)).not.toThrow();
  });

  it('authors parent relationships as clickable vault links while exposing normalized IDs to tools', () => {
    for (const view of catalogue.filter(view => view.parent !== null)) {
      expect(readFileSync(resolve(root, 'docs/components/views', view.file), 'utf8')).toContain(`parent: "[[docs/components/views/${view.parent}]]"`);
      expect(catalogue.some(parent => parent.id === view.parent)).toBe(true);
    }
  });

  it('rejects ownership drift for root pages, local subpages and public entry points', () => {
    for (const [id, parent] of [['board', 'council'], ['council-ask', 'studio'], ['public-kanban', 'studio'], ['workflow', 'studio'], ['workflow-settings', 'settings'], ['settings-request-object', 'workflow']]) {
      expect(() => sourceCoverage(catalogue.map(view => view.id === id ? { ...view, parent } : view), root)).toThrow(/parent|ownership/);
    }
  });

  it("documents every live route and nested navigation state exactly once", () => {
    const views = catalogue;
    expect(views.length).toBeGreaterThan(40);
    expect(() => sourceCoverage(views, root)).not.toThrow();
    const board = views.find((view) => view.id === "board");
    expect(() => sourceCoverage(views.filter((view) => view !== board), root)).toThrow(/board/);
    expect(() => sourceCoverage([...views, { ...board, id: "board-copy" }], root)).toThrow(/coverage/);
    expect(() => sourceCoverage(views.map((view) => view.id === "broadcast-music" ? { ...view, coverage: undefined } : view), root)).toThrow(/music/);
    expect(() => sourceCoverage(views.map((view) => view.id === "settings-runtime" ? { ...view, coverage: undefined } : view), root)).toThrow(/runtime/);
    expect(() => sourceCoverage([...views, { ...board, id: "stale", coverage: { group: "studio", key: "retired" } }], root)).toThrow(/retired/);
  });

  it("keeps generated Markdown and JSON in sync with canonical files", () => {
    const views = catalogue;
    const output = renderSitemap(views);
    expect(readFileSync(resolve(root, "docs/components/sitemap.md"), "utf8")).toBe(output.markdown);
    expect(readFileSync(resolve(root, "docs/components/sitemap.json"), "utf8")).toBe(output.json);
    expect(output.markdown).toContain("[Request board](views/board.md)");
    expect(renderSitemap([...views].reverse())).toEqual(output);
  });

  it('accepts one nested settings contract covering its compatibility locator and local workflow page', () => {
    const views = catalogue.map(view => view.id === 'workflow-settings'
      ? { ...view, coverage: [{ group: 'studio', key: 'workflow-settings' }, { group: 'workflow', key: 'settings' }] }
      : view);
    expect(() => validateCatalogue(views, root)).not.toThrow();
    expect(() => sourceCoverage(views, root)).not.toThrow();
  });

  it('rejects malformed or empty coverage arrays instead of silently reducing route coverage', () => {
    for (const coverage of [[], [null], ['workflow'], [{ group: 'workflow' }], [{ group: 'workflow', key: 1 }]])
      expect(() => validateCatalogue([{ ...sample('invalid'), coverage }], root)).toThrow(/coverage/);
  });

  it('rejects duplicate, missing, stale and unknown nested coverage mappings', () => {
    const views = catalogue;
    const mappings = [{ group: 'studio', key: 'workflow-settings' }, { group: 'workflow', key: 'settings' }];
    const withCoverage = coverage => views.map(view => view.id === 'workflow-settings' ? { ...view, coverage } : view);
    expect(() => sourceCoverage(withCoverage([...mappings, mappings[1]]), root)).toThrow(/duplicate/);
    expect(() => sourceCoverage([...withCoverage(mappings), { ...sample('copy'), coverage: { group: 'workflow', key: 'settings' } }], root)).toThrow(/duplicate/);
    expect(() => sourceCoverage(withCoverage([mappings[1]]), root)).toThrow(/workflow-settings/);
    expect(() => sourceCoverage(withCoverage([mappings[0]]), root)).toThrow(/settings/);
    expect(() => sourceCoverage(withCoverage([...mappings, { group: 'workflow', key: 'retired' }]), root)).toThrow(/retired/);
    expect(() => sourceCoverage(withCoverage([...mappings, { group: 'unknown', key: 'settings' }]), root)).toThrow(/unknown coverage group/);
    for (const group of ['__proto__', 'constructor'])
      expect(() => sourceCoverage(withCoverage([...mappings, { group, key: 'settings' }]), root)).toThrow(/unknown coverage group/);
  });
});
