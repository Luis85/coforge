import {
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  stringify,
  visit,
} from "yaml";
import {
  boolean,
  number,
  oneOf,
  record,
  shape,
  text,
  type Check,
} from "../../features/coforge/domain/check";

export interface CouncilSubmissionMetadata {
  schema: "submission/v1";
  id: string;
  generation: number;
  draft: boolean;
  ready: boolean;
}
export interface SourceDocument {
  yaml: string;
  body: string;
  prefix: string;
  suffix: string;
  metadata?: CouncilSubmissionMetadata;
  start?: number;
  end?: number;
  controls?: { draft?: boolean; ready?: boolean };
  controlRanges?: Array<{
    key: "Draft" | "Ready";
    start: number;
    end: number;
    pairStart: number;
    pairEnd: number;
  }>;
}
const submissionCheck: Check<CouncilSubmissionMetadata> = shape(
  {
    schema: oneOf(["submission/v1"]),
    id: text({ min: 1, max: 200, pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u }),
    generation: number({ min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }),
    draft: boolean,
    ready: boolean,
  },
  { strict: true },
);

export function parseSourceDocument(markdown: string): SourceDocument {
  if (markdown.length > 2 * 1024 * 1024)
    throw new Error("Source note exceeds the safe input size limit.");
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(markdown);
  if (!match) {
    if (/^---\r?\n/u.test(markdown))
      throw new Error("Invalid source frontmatter.");
    return { yaml: "", body: markdown, prefix: "---\n", suffix: "\n---\n" };
  }
  const yaml = match[2] ?? "";
  const document = parseDocument(yaml, { uniqueKeys: true, strict: true });
  if (
    document.errors.length ||
    document.warnings.length ||
    (document.contents && !isMap(document.contents))
  )
    throw new Error("Invalid source frontmatter.");
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
    throw new Error(
      "Unsafe source frontmatter. YAML aliases and merge keys are unsupported.",
    );
  const source: SourceDocument = {
    yaml,
    body: markdown.slice(match[0].length),
    prefix: match[1] ?? "---\n",
    suffix: match[3] ?? "\n---\n",
  };
  if (isMap(document.contents)) {
    for (const key of ["Draft", "Ready"] as const) {
      const control = document.contents.items.find(
        (item) => isScalar(item.key) && item.key.value === key,
      );
      if (!control) continue;
      if (
        !isScalar(control.value) ||
        typeof control.value.value !== "boolean" ||
        !control.value.range ||
        !isScalar(control.key) ||
        !control.key.range
      )
        throw new Error("Draft and Ready properties must be booleans.");
      source.controls ??= {};
      source.controls[key === "Draft" ? "draft" : "ready"] =
        control.value.value;
      source.controlRanges ??= [];
      source.controlRanges.push({
        key,
        start: control.value.range[0],
        end: control.value.range[1],
        pairStart: control.key.range[0],
        pairEnd: control.value.range[2],
      });
    }
    const pair = document.contents.items.find(
      (item) => isScalar(item.key) && item.key.value === "coforge_submission",
    );
    if (pair) {
      source.metadata = submissionCheck(
        record(document.toJS({ maxAliasCount: 0 })).coforge_submission,
      );
      if (
        isScalar(pair.key) &&
        pair.key.range &&
        pair.value &&
        "range" in pair.value &&
        pair.value.range
      ) {
        source.start = pair.key.range[0];
        source.end = pair.value.range[2];
      } else throw new Error("Invalid source frontmatter submission identity.");
    }
  }
  return source;
}
export function writeCouncilSubmission(
  markdown: string,
  input: CouncilSubmissionMetadata,
): string {
  const metadata = submissionCheck(input);
  const source = parseSourceDocument(markdown);
  if (source.metadata && source.metadata.id !== metadata.id)
    throw new Error("Submission identity cannot change during an edit.");
  const eol = source.prefix.includes("\r\n") ? "\r\n" : "\n";
  const reserved = stringify({ coforge_submission: metadata }, { lineWidth: 0 })
    .replaceAll("\n", eol)
    .replace(/\r?\n$/u, "");
  let yaml = source.yaml;
  if (source.start !== undefined && source.end !== undefined) {
    const trailing = yaml.slice(source.end);
    yaml =
      yaml.slice(0, source.start) +
      reserved +
      (trailing && !/^[\r\n]/u.test(trailing) ? eol : "") +
      trailing;
  } else yaml += (yaml && !/[\r\n]$/u.test(yaml) ? eol : "") + reserved;
  return `${source.prefix}${yaml}${source.suffix}${source.body}`;
}
export function sourceWithoutIdentity(source: SourceDocument): string {
  const ranges = [
    ...(source.controlRanges ?? []).map((item) => ({
      start: item.pairStart,
      end: item.pairEnd,
    })),
    ...(source.start !== undefined && source.end !== undefined
      ? [{ start: source.start, end: source.end }]
      : []),
  ].sort((a, b) => b.start - a.start);
  let yaml = source.yaml;
  for (const range of ranges)
    yaml = yaml.slice(0, range.start) + yaml.slice(range.end);
  return yaml.trim()
    ? `${source.prefix}${yaml.trimEnd()}${source.suffix}${source.body}`
    : source.body;
}
/** UI flags and top-level Obsidian properties share one atomic edit, preserving every unrelated byte. */
export function writeCouncilSubmissionState(
  markdown: string,
  metadata: CouncilSubmissionMetadata,
): string {
  const withIdentity = writeCouncilSubmission(markdown, metadata);
  const source = parseSourceDocument(withIdentity);
  let yaml = source.yaml;
  for (const range of [...(source.controlRanges ?? [])].sort(
    (a, b) => b.start - a.start,
  ))
    yaml =
      yaml.slice(0, range.start) +
      String(range.key === "Draft" ? metadata.draft : metadata.ready) +
      yaml.slice(range.end);
  return `${source.prefix}${yaml}${source.suffix}${source.body}`;
}
