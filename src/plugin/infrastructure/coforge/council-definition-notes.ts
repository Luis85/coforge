import {
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  stringify,
  visit,
} from "yaml";
import { record } from "../../features/coforge/domain/check";
import {
  councilDocumentCheck,
  definitionRevision,
  type CouncilDefinitionDocument,
} from "../../features/coforge/domain/council-definitions";

interface ParsedNote {
  yaml: string;
  body: string;
  prefix: string;
  suffix: string;
  reservedStart?: number;
  reservedEnd?: number;
  properties: Record<string, unknown>;
}
function parseNote(markdown: string): ParsedNote {
  if (markdown.length > 1000000)
    throw new Error("Definition note exceeds its size limit.");
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(markdown);
  if (!match) {
    if (/^---\r?\n/u.test(markdown))
      throw new Error("Invalid definition frontmatter.");
    return {
      yaml: "",
      body: markdown,
      prefix: "---\n",
      suffix: "\n---\n",
      properties: {},
    };
  }
  const yaml = match[2] ?? "";
  const document = parseDocument(yaml, { uniqueKeys: true, strict: true });
  if (
    document.errors.length ||
    document.warnings.length ||
    !isMap(document.contents)
  )
    throw new Error("Invalid definition frontmatter.");
  let unsafe = false;
  visit(document, (key, node, path) => {
    if (
      isAlias(node) ||
      path.length > 30 ||
      (isScalar(node) &&
        key === "key" &&
        (typeof node.value !== "string" ||
          ["__proto__", "prototype", "constructor", "<<"].includes(node.value)))
    ) {
      unsafe = true;
      return visit.BREAK;
    }
    return undefined;
  });
  if (unsafe)
    throw new Error("Unsupported YAML aliases or keys in definition.");
  const properties = record(document.toJS({ maxAliasCount: 0 }));
  const pair = document.contents.items.find(
    (item) => isScalar(item.key) && item.key.value === "coforge",
  );
  return {
    yaml,
    body: markdown.slice(match[0].length),
    prefix: match[1] ?? "---\n",
    suffix: match[3] ?? "\n---\n",
    properties,
    ...(pair &&
    isScalar(pair.key) &&
    pair.key.range &&
    pair.value &&
    "range" in pair.value &&
    pair.value.range
      ? { reservedStart: pair.key.range[0], reservedEnd: pair.value.range[2] }
      : {}),
  };
}
function sectionMarker(id: string, end = false): string {
  return `<!-- coforge:${id}:${end ? "end" : "start"} -->`;
}
function sectionRange(
  body: string,
  id: string,
): { start: number; end: number; text: string } | undefined {
  const marker = sectionMarker(id);
  const close = sectionMarker(id, true);
  const start = body.indexOf(marker);
  if (start < 0) return undefined;
  const contentStart = start + marker.length;
  const finish = body.indexOf(close, contentStart);
  if (
    finish < 0 ||
    body.indexOf(marker, contentStart) >= 0 ||
    body.indexOf(close, finish + close.length) >= 0
  )
    throw new Error("Definition has duplicate or incomplete managed sections.");
  const raw = body.slice(contentStart, finish);
  if (!raw.startsWith("\n") || !raw.endsWith("\n"))
    throw new Error("Malformed managed instructions section.");
  return { start, end: finish + close.length, text: raw.slice(1, -1) };
}
function readInstructions(body: string, id: string): string {
  const section = sectionRange(body, id);
  if (!section) throw new Error("Definition instructions section is missing.");
  return section.text;
}
/** Canonical instructions live in readable body sections; YAML owns configuration only. */
export function readCouncilDefinitionNote(
  markdown: string,
): CouncilDefinitionDocument {
  const note = parseNote(markdown);
  const config = { ...record(note.properties.coforge) };
  if (config.schema === "agent/v1" && "instructions" in config)
    throw new Error(
      "Agent instructions belong to the managed Markdown body section.",
    );
  if (config.schema === "agent/v1")
    config.instructions = readInstructions(note.body, "instructions");
  if (config.schema === "council/v1") {
    if (!Array.isArray(config.rounds))
      throw new Error("Council rounds must be a list.");
    config.rounds = config.rounds.map((value: unknown) => {
      const item = record(value);
      if ("instructions" in item)
        throw new Error(
          "Round instructions belong to the managed Markdown body section.",
        );
      if (
        typeof item.id !== "string" ||
        !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(item.id)
      )
        throw new Error("Invalid round identity.");
      return {
        ...item,
        instructions: readInstructions(note.body, `round-${item.id}`),
      };
    });
  }
  return councilDocumentCheck(config);
}
function managedSection(
  body: string,
  id: string,
  heading: string,
  instructions: string,
): string {
  if (instructions.includes("<!-- coforge:"))
    throw new Error("Instructions contain a reserved managed-section marker.");
  const range = sectionRange(body, id);
  const content = `${sectionMarker(id)}\n${instructions}\n${sectionMarker(id, true)}`;
  if (range)
    return body.slice(0, range.start) + content + body.slice(range.end);
  return `${body}${body && !body.endsWith("\n") ? "\n" : ""}\n## ${heading}\n\n${content}\n`;
}
export function writeCouncilDefinitionNote(
  markdown: string,
  value: CouncilDefinitionDocument,
): string {
  const definition = councilDocumentCheck(value);
  const note = parseNote(markdown);
  if (note.properties.coforge !== undefined) {
    const previous = readCouncilDefinitionNote(markdown);
    if (previous.id !== definition.id || previous.schema !== definition.schema)
      throw new Error("Definition identity cannot change during an edit.");
  }
  let body = note.body;
  const config: Record<string, unknown> = { ...definition };
  if (definition.schema === "agent/v1") {
    delete config.instructions;
    body = managedSection(
      body,
      "instructions",
      "Instructions",
      definition.instructions,
    );
  }
  if (definition.schema === "council/v1") {
    config.rounds = definition.rounds.map((item) => {
      const { instructions, ...configuration } = item;
      body = managedSection(body, `round-${item.id}`, item.name, instructions);
      return configuration;
    });
  }
  const eol = note.prefix.includes("\r\n") ? "\r\n" : "\n";
  const reserved = stringify({ coforge: config }, { lineWidth: 0 })
    .replaceAll("\n", eol)
    .replace(/\r?\n$/u, "");
  let yaml: string;
  if (note.reservedStart !== undefined && note.reservedEnd !== undefined) {
    const trailing = note.yaml.slice(note.reservedEnd);
    yaml =
      note.yaml.slice(0, note.reservedStart) +
      reserved +
      (trailing && !trailing.startsWith("\n") && !trailing.startsWith("\r\n")
        ? eol
        : "") +
      trailing;
  } else yaml = note.yaml + (note.yaml ? eol : "") + reserved;
  return `${note.prefix}${yaml}${note.suffix}${body}`;
}
export function duplicateCouncilDefinition(
  value: CouncilDefinitionDocument,
  newId: string,
): CouncilDefinitionDocument {
  if (newId === value.id)
    throw new Error("A duplicate requires a new identity.");
  return councilDocumentCheck({
    ...structuredClone(value),
    id: newId,
    name: `${value.name} copy`,
    enabled: false,
  });
}
export interface IndexedCouncilDefinition {
  path: string;
  definition: CouncilDefinitionDocument;
  revision: string;
}
export function indexCouncilDefinitions(
  notes: readonly { path: string; markdown: string }[],
): {
  valid: IndexedCouncilDefinition[];
  invalid: Array<{ path: string; reason: string }>;
} {
  const candidates: IndexedCouncilDefinition[] = [];
  const invalid: Array<{ path: string; reason: string }> = [];
  for (const note of notes) {
    try {
      const definition = readCouncilDefinitionNote(note.markdown);
      candidates.push({
        path: note.path,
        definition,
        revision: definitionRevision(definition),
      });
    } catch {
      invalid.push({
        path: note.path,
        reason:
          "The current definition is invalid. Repair its schema, instructions and references before new work.",
      });
    }
  }
  const counts = new Map<string, number>();
  for (const candidate of candidates)
    counts.set(
      candidate.definition.id,
      (counts.get(candidate.definition.id) ?? 0) + 1,
    );
  const valid = candidates.filter((candidate) => {
    if (counts.get(candidate.definition.id) === 1) return true;
    invalid.push({
      path: candidate.path,
      reason:
        "Duplicate definition identity. Assign a new ID to the copy before new work.",
    });
    return false;
  });
  return { valid, invalid };
}
