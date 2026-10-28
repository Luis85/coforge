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
  workflowV2DefinitionCheck,
  type WorkflowV2Definition,
} from "../../features/coforge/domain/configured-workflow-v2";
import { contextEventId } from "../../features/coforge/domain/integrity";
import type { StoredWorkflowV2 } from "../../features/coforge/application/workflow-v2-ports";

const PROPERTY = "coforge_workflow_v2";
function parseNote(markdown: string) {
  if (markdown.length > 2 * 1024 * 1024)
    throw new Error("The project note exceeds its workflow editing limit.");
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(markdown);
  if (!match && /^---\r?\n/u.test(markdown))
    throw new Error("The project frontmatter is invalid.");
  const yaml = match?.[2] ?? "";
  const document = parseDocument(yaml, { uniqueKeys: true, strict: true });
  if (
    document.errors.length ||
    document.warnings.length ||
    (document.contents && !isMap(document.contents))
  )
    throw new Error("The project frontmatter is invalid.");
  let unsafe = false;
  visit(document, (key, node, path) => {
    if (
      isAlias(node) ||
      path.length > 30 ||
      (isScalar(node) &&
        key === "key" &&
        (typeof node.value !== "string" ||
          ["__proto__", "constructor", "prototype", "<<"].includes(node.value)))
    ) {
      unsafe = true;
      return visit.BREAK;
    }
    return undefined;
  });
  if (unsafe)
    throw new Error(
      "Project frontmatter aliases and unsafe keys cannot be edited as workflow configuration.",
    );
  const properties = document.contents
    ? record(document.toJS({ maxAliasCount: 0 }))
    : {};
  const pair = isMap(document.contents)
    ? document.contents.items.find(
        (item) => isScalar(item.key) && item.key.value === PROPERTY,
      )
    : undefined;
  let range: { start: number; end: number } | undefined;
  if (pair) {
    if (
      !isScalar(pair.key) ||
      !pair.key.range ||
      !pair.value ||
      !("range" in pair.value) ||
      !pair.value.range
    )
      throw new Error("The workflow property has no safe editable range.");
    range = { start: pair.key.range[0], end: pair.value.range[2] };
  }
  return {
    yaml,
    properties,
    range,
    prefix: match?.[1] ?? "---\n",
    suffix: match?.[3] ?? "\n---\n",
    body: match ? markdown.slice(match[0].length) : markdown,
  };
}
export function readWorkflowV2Note(markdown: string): StoredWorkflowV2 {
  const note = parseNote(markdown);
  if (note.properties[PROPERTY] === undefined)
    return { definition: null, revision: "" };
  const definition = workflowV2DefinitionCheck(note.properties[PROPERTY]);
  return { definition, revision: contextEventId(JSON.stringify(definition)) };
}
export function writeWorkflowV2Note(
  markdown: string,
  value: WorkflowV2Definition,
  expectedRevision = "",
): string {
  const note = parseNote(markdown);
  const current = readWorkflowV2Note(markdown);
  if (current.revision !== expectedRevision)
    throw new Error(
      "The project workflow changed. Refresh before saving; the draft and note are preserved.",
    );
  const checked = workflowV2DefinitionCheck(value);
  const definition = {
    ...checked,
    revision: `wf2-${contextEventId(JSON.stringify({ ...checked, revision: "" }))}`,
  };
  const eol = note.prefix.includes("\r\n") ? "\r\n" : "\n";
  const property = stringify({ [PROPERTY]: definition }, { lineWidth: 0 })
    .replaceAll("\n", eol)
    .replace(/\r?\n$/u, "");
  let yaml: string;
  if (note.range) {
    const trailing = note.yaml.slice(note.range.end);
    yaml =
      note.yaml.slice(0, note.range.start) +
      property +
      (trailing && !/^[\r\n]/u.test(trailing) ? eol : "") +
      trailing;
  } else
    yaml =
      note.yaml +
      (note.yaml && !/[\r\n]$/u.test(note.yaml) ? eol : "") +
      property;
  return `${note.prefix}${yaml}${note.suffix}${note.body}`;
}
