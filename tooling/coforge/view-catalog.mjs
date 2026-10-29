import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import ts from 'typescript';

const FOLDER = "docs/components/views";
const TEXT_FIELDS = ["id", "title", "goal", "audience", "kind", "route", "component", "privacy"];
const LIST_FIELDS = ["entry", "actions", "states", "journeys"];
const KINDS = new Set(["shell", "page", "subpage", "panel", "dialog", "native", "public"]);
const strings = (source) => [...source.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);

/** One task can own both a current local locator and a compatibility alias. */
function coverageMappings(view) {
  if (view.coverage === undefined) return [];
  const mappings = Array.isArray(view.coverage) ? view.coverage : [view.coverage];
  if (!mappings.length || mappings.some(mapping => !mapping || typeof mapping !== "object"
    || Array.isArray(mapping) || typeof mapping.group !== "string" || !mapping.group.trim()
    || typeof mapping.key !== "string" || !mapping.key.trim()))
    throw new Error(`${view.file}: invalid coverage contract`);
  if (new Set(mappings.map(mapping => `${mapping.group}\n${mapping.key}`)).size !== mappings.length)
    throw new Error(`${view.file}: duplicate coverage contract`);
  return mappings;
}

/** Parent spellings normalize to catalogue identities without rewriting their authored notes. */
export function parentReferenceId(value) {
  return typeof value === 'string' ? value.match(/^\[\[(?:docs\/components\/views\/)?([a-z][a-z0-9-]*)\]\]$/)?.[1] ?? value : value;
}

/** Markdown files are the sole authored source; sitemap output contains no independent inventory. */
export function readCatalogue(root) {
  return readdirSync(resolve(root, FOLDER)).filter((file) => file.endsWith(".md")).sort().map((file) => {
    const source = readFileSync(resolve(root, FOLDER, file), "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
    if (!match) throw new Error(`${file}: expected frontmatter plus Markdown`);
    const data = parse(match[1]);
    const parent = parentReferenceId(data.parent);
    return { ...data, parent, body: match[2].trim(), file };
  });
}

export function validateCatalogue(views, root) {
  const byId = new Map();
  const routes = new Set();
  for (const view of views) {
    for (const key of TEXT_FIELDS) {
      if (typeof view[key] !== "string" || !view[key].trim()) throw new Error(`${view.file}: missing ${key}`);
    }
    for (const key of LIST_FIELDS) {
      if (!Array.isArray(view[key]) || !view[key].length || view[key].some((value) => typeof value !== "string" || !value.trim())) {
        throw new Error(`${view.file}: ${key} must contain authored text`);
      }
    }
    if (!KINDS.has(view.kind)) throw new Error(`${view.file}: unknown kind ${view.kind}`);
    if (view.parent !== null && (typeof view.parent !== "string" || !view.parent.trim())) throw new Error(`${view.file}: parent must be null or a view id`);
    if (!/^[a-z][a-z0-9-]*$/.test(view.id) || view.file !== `${view.id}.md`) throw new Error(`${view.file}: filename must match stable id`);
    if (byId.has(view.id)) throw new Error(`Duplicate view id ${view.id}`);
    if (routes.has(view.route)) throw new Error(`Duplicate route ${view.route}`);
    routes.add(view.route);
    const componentPath = relative(root, resolve(root, view.component));
    if (componentPath.startsWith("..") || isAbsolute(componentPath)) throw new Error(`${view.file}: component must stay inside the project`);
    if (!existsSync(resolve(root, view.component))) throw new Error(`${view.file}: missing component ${view.component}`);
    if (!view.body?.includes("## Purpose")) throw new Error(`${view.file}: missing Purpose documentation`);
    for (const link of view.body.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
      const href = link[1].split("#")[0];
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const target = resolve(root, FOLDER, dirname(view.file), decodeURIComponent(href));
      const localPath = relative(root, target);
      if (localPath.startsWith("..") || isAbsolute(localPath) || !existsSync(target)) throw new Error(`${view.file}: broken local Markdown link ${href}`);
    }
    coverageMappings(view);
    byId.set(view.id, view);
  }
  const publicViews = views.filter(view => view.kind === 'public');
  if (publicViews.length || byId.has('public')) {
    const family = byId.get('public');
    if (!family || family.kind !== 'shell' || family.parent !== null)
      throw new Error('Public views require an independent Public shell with no parent');
    for (const view of publicViews) {
      if (view.parent !== 'public') throw new Error(`${view.file}: public view parent ownership must be public`);
    }
  }
  for (const view of views) {
    const visited = new Set([view.id]);
    let ancestor = view.parent;
    while (ancestor) {
      if (!byId.has(ancestor)) throw new Error(`${view.file}: unknown parent ${ancestor}`);
      if (visited.has(ancestor)) throw new Error(`${view.file}: parent cycle at ${ancestor}`);
      visited.add(ancestor);
      ancestor = byId.get(ancestor).parent;
    }
  }
}

const read = (root, path) => readFileSync(resolve(root, path), "utf8");
function studioParents(root) {
  const file = ts.createSourceFile('studio-destinations.ts', read(root, 'src/plugin/presentation/stores/studio-destinations.ts'), ts.ScriptTarget.Latest, true);
  const declaration = file.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).find(item => item.name.getText(file) === 'STUDIO_DESTINATIONS');
  const expression = declaration?.initializer;
  const value = expression && ts.isSatisfiesExpression(expression) ? expression.expression : expression;
  if (!value || !ts.isObjectLiteralExpression(value)) throw new Error('Cannot read studio ownership contract');
  return new Map(value.properties.filter(ts.isPropertyAssignment).map(property => {
    const id = ts.isStringLiteral(property.name) ? property.name.text : property.name.getText(file);
    const owner = ts.isObjectLiteralExpression(property.initializer) ? property.initializer.properties.filter(ts.isPropertyAssignment).find(item => item.name.getText(file) === 'parent')?.initializer : undefined;
    return [id, owner && ts.isStringLiteral(owner) ? owner.text : 'studio'];
  }));
}
function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Cannot read ${label} navigation contract; update catalogue coverage adapter`);
  return match[1];
}

/** Read live state contracts rather than maintaining a second list of route names. */
export function sourceCoverage(views, root) {
  const studio = read(root, "src/plugin/presentation/stores/coforge-studio.ts");
  const pages = read(root, "src/plugin/presentation/stores/studio-pages.ts");
  const surfaces = read(root, "src/plugin/features/coforge/domain/stream-surfaces.ts");
  const pageIds = (name) => [...requiredMatch(pages, new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`), name).matchAll(/id:\s*["']([^"']+)["']/g)].map((match) => match[1]);
  const groups = {
    studio: strings(requiredMatch(studio, /export type StudioView\s*=([\s\S]*?);/, "studio")),
    idea: strings(requiredMatch(studio, /export type IdeaDrawerTab\s*=([\s\S]*?);/, "idea drawer")),
    council: pageIds("COUNCIL_PAGES"),
    broadcast: pageIds("BROADCAST_PAGES"),
    workflow: pageIds("WORKFLOW_PAGES"),
    settings: pageIds("SETTINGS_PAGES"),
    economy: pageIds("ECONOMY_PAGES"),
    stream: pageIds("STREAM_PAGES"),
    public: [...requiredMatch(surfaces, /export const STREAM_SURFACES = \[([\s\S]*?)\] as const/, "public surface").matchAll(/id:\s*["']([^"']+)["']/g)].map((match) => match[1]),
  };
  const documentedMappings = views.flatMap(view => coverageMappings(view).map(mapping => ({ ...mapping, file: view.file })));
  const parents = studioParents(root);
  const localParents = { council: 'council', broadcast: 'broadcast', workflow: 'workflow', settings: 'settings', economy: 'economy', stream: 'stream', idea: 'idea-detail', public: 'public' };
  for (const [group, expected] of Object.entries(groups)) {
    if (!expected.length) throw new Error(`${group}: empty navigation contract; update catalogue coverage adapter`);
    const documented = documentedMappings.filter(mapping => mapping.group === group).map(mapping => mapping.key);
    const missing = expected.filter((key) => !documented.includes(key));
    const stale = documented.filter((key) => !expected.includes(key));
    if (missing.length || stale.length || new Set(documented).size !== documented.length) {
      throw new Error(`${group} coverage mismatch: missing [${missing.join(", ")}], stale [${stale.join(", ")}], or duplicate coverage`);
    }
  }
  for (const mapping of documentedMappings) {
    if (!Object.hasOwn(groups, mapping.group)) throw new Error(`${mapping.file}: unknown coverage group`);
  }
  for (const view of views) for (const mapping of coverageMappings(view)) {
    const expected = mapping.group === 'studio' ? parents.get(mapping.key) : localParents[mapping.group];
    if (expected !== undefined && view.parent !== expected) throw new Error(`${view.file}: parent ownership must be ${expected ?? 'an independent entry'}`);
  }
}

const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
export function renderSitemap(views) {
  const sorted = [...views].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const lines = ["# CoForge sitemap", "", "Generated from the frontmatter and Markdown in `docs/components/views/`. Do not edit this file directly.", "", "Regenerate: `node tooling/coforge/view-catalog.mjs`. Verify: `node tooling/coforge/view-catalog.mjs --check`.", "", "Routes below describe local UI state, not browser URLs. Panels and dialogs remain explicit children of their owning page; they do not imply independent Obsidian tabs.", "", "## Navigation tree", ""];
  const tree = (parent, depth) => {
    for (const view of sorted.filter((entry) => entry.parent === parent)) {
      lines.push(`${"  ".repeat(depth)}- [${view.title}](views/${view.file}) — ${view.kind}`);
      tree(view.id, depth + 1);
    }
  };
  tree(null, 0);
  lines.push("", "## User goals and routes", "", "| View | User goal | Route/state | Audience |", "| --- | --- | --- | --- |");
  for (const view of sorted) lines.push(`| [${cell(view.title)}](views/${view.file}) | ${cell(view.goal)} | ${cell(view.route)} | ${cell(view.audience)} |`);
  lines.push("", "## Journey coverage", "");
  const journeys = [...new Set(sorted.flatMap((view) => view.journeys))].sort();
  for (const journey of journeys) {
    lines.push(`- **${journey}**: ${sorted.filter((view) => view.journeys.includes(journey)).map((view) => `[${view.title}](views/${view.file})`).join(", ")}`);
  }
  return {
    markdown: `${lines.join("\n")}\n`,
    json: `${JSON.stringify({ schema: 1, source: FOLDER, views: sorted.map(({ body: _body, ...view }) => view) }, null, 2)}\n`,
  };
}

export function generate(root, check = false) {
  const views = readCatalogue(root);
  validateCatalogue(views, root);
  sourceCoverage(views, root);
  const output = renderSitemap(views);
  for (const [file, value] of [["sitemap.md", output.markdown], ["sitemap.json", output.json]]) {
    const path = resolve(root, "docs/components", file);
    if (check) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== value) throw new Error(`${file} is stale; run node tooling/coforge/view-catalog.mjs`);
    } else writeFileSync(path, value);
  }
  return `${views.length} views documented; navigation coverage valid; sitemap ${check ? "current" : "generated"}.`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(generate(process.cwd(), process.argv.includes("--check")));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
