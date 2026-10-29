import {
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  stringify,
  visit,
} from "yaml";
import {
  oneOf,
  record,
  shape,
  text,
} from "../../features/coforge/domain/check";
import { contextEventId } from "../../features/coforge/domain/integrity";
import {
  outputTemplateIdCheck,
  workflowOutputTemplateInputCheck,
  type WorkflowOutputTemplate,
  type WorkflowOutputTemplateInput,
} from "../../features/coforge/domain/workflow-output-templates";

const configCheck = shape(
  {
    schema: oneOf(["coforge-output-template/v1"] as const),
    id: outputTemplateIdCheck,
    projectId: outputTemplateIdCheck,
    name: text({ trim: true, min: 1, max: 100 }),
  },
  { strict: true },
);
function parseNote(markdown: string) {
  if (markdown.length > 1000000)
    throw new Error("The output template note exceeds its editing limit.");
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(markdown);
  if (!match && /^---\r?\n/u.test(markdown))
    throw new Error("The output template frontmatter is invalid.");
  const yaml = match?.[2] ?? "";
  const document = parseDocument(yaml, { uniqueKeys: true, strict: true });
  if (
    document.errors.length ||
    document.warnings.length ||
    (document.contents && !isMap(document.contents))
  )
    throw new Error("The output template frontmatter is invalid.");
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
      "Output template frontmatter aliases and unsafe keys cannot be edited.",
    );
  const properties = document.contents
    ? record(document.toJS({ maxAliasCount: 0 }))
    : {};
  const pair = isMap(document.contents)
    ? document.contents.items.find(
        (item) => isScalar(item.key) && item.key.value === "coforge",
      )
    : undefined;
  let range: { start: number; end: number; indent: string } | undefined;
  if (pair) {
    if (
      !isScalar(pair.key) ||
      !pair.key.range ||
      !pair.value ||
      !("range" in pair.value) ||
      !pair.value.range
    )
      throw new Error(
        "The output template metadata has no safe editable range.",
      );
    const start = pair.key.range[0];
    range = {
      start,
      end: pair.value.range[1],
      indent: yaml.slice(yaml.lastIndexOf("\n", start - 1) + 1, start),
    };
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
export function readWorkflowOutputTemplateNote(
  markdown: string,
): WorkflowOutputTemplate {
  const note = parseNote(markdown);
  const config = configCheck(note.properties.coforge);
  const authored = workflowOutputTemplateInputCheck({
    name: config.name,
    markdown: note.body,
  });
  return {
    id: config.id,
    projectId: config.projectId,
    ...authored,
    revision: contextEventId(markdown),
  };
}
/** Only the reserved metadata property and the intentionally edited template body change. */
export function writeWorkflowOutputTemplateNote(
  current: string,
  projectId: string,
  id: string,
  value: WorkflowOutputTemplateInput,
): string {
  const authored = workflowOutputTemplateInputCheck(value);
  const config = configCheck({
    schema: "coforge-output-template/v1",
    projectId,
    id,
    name: authored.name,
  });
  const note = parseNote(current);
  if (current) {
    const previous = readWorkflowOutputTemplateNote(current);
    if (previous.id !== id || previous.projectId !== projectId)
      throw new Error(
        "The output template identity cannot change while editing.",
      );
  }
  const eol = note.prefix.includes("\r\n") ? "\r\n" : "\n";
  const indent = note.range?.indent ?? "";
  if (!/^ *$/u.test(indent))
    throw new Error(
      "Convert the output template frontmatter to block properties before editing. The note is preserved.",
    );
  const property = stringify({ coforge: config }, { lineWidth: 0 })
    .replace(/\n$/u, "")
    .replaceAll("\n", eol + indent);
  const trailing = note.range ? note.yaml.slice(note.range.end) : "";
  const yaml = note.range
    ? note.yaml.slice(0, note.range.start) +
      property +
      (trailing && !/^[\r\n]/u.test(trailing) && !/^[ \t]+#/u.test(trailing)
        ? eol
        : "") +
      trailing
    : note.yaml +
      (note.yaml && !/[\r\n]$/u.test(note.yaml) ? eol : "") +
      property;
  const next = `${note.prefix}${yaml}${note.suffix}${authored.markdown}`;
  const checked = readWorkflowOutputTemplateNote(next);
  if (
    checked.id !== id ||
    checked.projectId !== projectId ||
    checked.name !== authored.name ||
    checked.markdown !== authored.markdown
  )
    throw new Error(
      "The output template could not be safely serialized. The note is preserved.",
    );
  return next;
}
