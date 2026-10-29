import {
  boolean,
  list,
  number,
  oneOf,
  optional,
  record,
  shape,
  text,
} from "./check";
import { cleanLine, cleanText } from "./sanitize";
import { contextEventId } from "./integrity-hash";
import { OWNED_PROPERTIES } from "./idea-owned-properties";
import { requestCategoriesCheck } from './request-categories';

export const REQUEST_OBJECT_FORMAT = "coforge-request-object/v1";
export const REQUEST_OBJECT_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "checkbox",
  "select",
] as const;
export const REQUEST_OBJECT_LIMITS = {
  fields: 24,
  options: 40,
  text: 2000,
} as const;
export type RequestFieldValue = string | number | boolean;
interface FieldBase {
  key: string;
  label: string;
}
export type RequestObjectField =
  | (FieldBase & { type: "text"; defaultValue?: string })
  | (FieldBase & { type: "number"; defaultValue?: number })
  | (FieldBase & { type: "date"; defaultValue?: string })
  | (FieldBase & { type: "checkbox"; defaultValue?: boolean })
  | (FieldBase & { type: "select"; options: string[]; defaultValue?: string });
export interface RequestObjectDefinition {
  format: typeof REQUEST_OBJECT_FORMAT;
  className: string;
  fields: RequestObjectField[];
  categories?: string[];
}
export interface RequestObjectSnapshot {
  className: string;
  fields: RequestObjectField[];
  values: Record<string, RequestFieldValue>;
  categories?: string[];
}

const comparableKey = (key: string) => key.toLowerCase().replace(/[-_]/gu, "");
const reserved = new Set<string>(
  [
    ...OWNED_PROPERTIES,
    "request-class",
    "request-object",
    "request-object-definition",
    "__proto__",
    "constructor",
    "prototype",
    "number",
    "projectId",
    "requestKind",
    "voters",
    "createdAt",
    "updatedAt",
    "authorId",
    "requestValues",
    "requestObjectRevision",
    "agentPrompt",
    "projectName",
    "projectBrief",
    "stageAgents",
    "stagePrompts",
    "settings",
    "runtime",
    "jobs",
    "events",
    "aliases",
    "tags",
    "cssclasses",
    "file",
    "path",
    "folder",
    "name",
    "description",
    "provider",
    "model",
    "project-path",
    "worktree-folder",
    "allow-implementation",
    "repository-url",
    "website-url",
    "paused",
    "interval-seconds",
    "min-votes",
    "max-turns",
    "max-budget-usd",
    "timeout-seconds",
    "request-cooldown-seconds",
  ].map(comparableKey),
);
export function requestObjectKeyCheck(value: unknown): string {
  const key = text({
    trim: true,
    min: 1,
    max: 64,
    pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/u,
  })(value);
  if (
    reserved.has(comparableKey(key)) ||
    /^(?:coforge|workflow|agent|automation|screening|rice|plan)[_-]/iu.test(key)
  )
    throw new Error(
      "Custom field keys cannot replace CoForge, Obsidian or prototype properties.",
    );
  return key;
}
const shortText = (value: unknown) =>
  text({ max: 80 })(cleanLine(text({ max: 320 })(value)));
const valueText = (value: unknown) =>
  text({ max: REQUEST_OBJECT_LIMITS.text })(
    cleanText(text({ max: REQUEST_OBJECT_LIMITS.text * 4 })(value)),
  );
const optionText = (value: unknown) =>
  text({ min: 1, max: 120 })(cleanLine(text({ min: 1, max: 480 })(value)));
function dateValue(value: unknown): string {
  const date =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : text({ pattern: /^\d{4}-\d{2}-\d{2}$/u })(value);
  if (
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("Enter a valid calendar date (YYYY-MM-DD).");
  return date;
}
export function requestObjectFieldCheck(value: unknown): RequestObjectField {
  const base = {
    key: requestObjectKeyCheck,
    label: (input: unknown) => text({ min: 1, max: 80 })(shortText(input)),
  };
  const type = oneOf(REQUEST_OBJECT_FIELD_TYPES)(record(value).type);
  if (type === "text")
    return shape(
      { ...base, type: oneOf(["text"]), defaultValue: optional(valueText) },
      { strict: true },
    )(value);
  if (type === "number")
    return shape(
      { ...base, type: oneOf(["number"]), defaultValue: optional(number()) },
      { strict: true },
    )(value);
  if (type === "date")
    return shape(
      { ...base, type: oneOf(["date"]), defaultValue: optional(dateValue) },
      { strict: true },
    )(value);
  if (type === "checkbox")
    return shape(
      { ...base, type: oneOf(["checkbox"]), defaultValue: optional(boolean) },
      { strict: true },
    )(value);
  const field = shape(
    {
      ...base,
      type: oneOf(["select"]),
      options: list(optionText, { min: 1, max: REQUEST_OBJECT_LIMITS.options }),
      defaultValue: optional(optionText),
    },
    { strict: true },
  )(value);
  if (new Set(field.options).size !== field.options.length)
    throw new Error("Select options must be unique.");
  if (
    field.defaultValue !== undefined &&
    !field.options.includes(field.defaultValue)
  )
    throw new Error("Select a default from the configured options.");
  return field;
}
export function requestObjectFieldsCheck(value: unknown): RequestObjectField[] {
  const fields = list(requestObjectFieldCheck, {
    max: REQUEST_OBJECT_LIMITS.fields,
  })(value);
  if (
    new Set(fields.map((field) => comparableKey(field.key))).size !==
    fields.length
  )
    throw new Error("Custom field keys must be unique.");
  return fields;
}
export const requestObjectDefinitionCheck = (
  value: unknown,
): RequestObjectDefinition =>
  shape(
    {
      format: oneOf([REQUEST_OBJECT_FORMAT] as const),
      className: shortText,
      fields: requestObjectFieldsCheck,
      categories: optional(requestCategoriesCheck),
    },
    { strict: true },
  )(value);

/** Primitive boundary validation; field-specific validation follows against the captured schema. */
export function requestValuesInputCheck(
  value: unknown,
): Record<string, RequestFieldValue> {
  const input = record(value);
  if (Object.keys(input).length > REQUEST_OBJECT_LIMITS.fields)
    throw new Error("Too many custom field values.");
  return Object.fromEntries(
    Object.entries(input).map(([key, entry]) => {
      requestObjectKeyCheck(key);
      if (typeof entry === "string") return [key, valueText(entry)];
      if (typeof entry === "number") return [key, number()(entry)];
      return [key, boolean(entry)];
    }),
  );
}
function fieldValue(
  field: RequestObjectField,
  value: unknown,
): RequestFieldValue {
  if (field.type === "text") return valueText(value);
  if (field.type === "number") return number()(value);
  if (field.type === "checkbox") return boolean(value);
  if (field.type === "date") return dateValue(value);
  const selected = optionText(value);
  if (!field.options.includes(selected))
    throw new Error(`Choose a configured option for ${field.label}.`);
  return selected;
}
export function requestObjectValuesCheck(
  fields: readonly RequestObjectField[],
  value: unknown,
  applyDefaults = false,
): Record<string, RequestFieldValue> {
  const input = record(value);
  const keys = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(input))
    if (!keys.has(key))
      throw new Error("A custom field is not part of this request schema.");
  return Object.fromEntries(
    fields.flatMap((field) => {
      const entry = Object.hasOwn(input, field.key)
        ? input[field.key]
        : applyDefaults
          ? field.defaultValue
          : undefined;
      return entry === undefined ? [] : [[field.key, fieldValue(field, entry)]];
    }),
  );
}
export function captureRequestObject(
  definition: RequestObjectDefinition | undefined,
  values: unknown = {},
): RequestObjectSnapshot | undefined {
  const checked = definition
    ? requestObjectDefinitionCheck(definition)
    : undefined;
  const fields = checked?.fields ?? [];
  const captured = requestObjectValuesCheck(fields, values, true);
  if (!checked || (!checked.className && !fields.length && !checked.categories?.length)) return undefined;
  return {
    className: checked.className,
    fields: structuredClone(fields),
    values: captured,
    ...(checked.categories ? { categories: [...checked.categories] } : {}),
  };
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, ordered(entry)]),
    );
  return value;
}
export const requestObjectRevision = (
  definition: RequestObjectDefinition | undefined,
): string =>
  contextEventId(
    JSON.stringify(
      ordered(definition ? requestObjectDefinitionCheck(definition) : null),
    ),
  );
export const requestObjectIdentity = (
  snapshot: RequestObjectSnapshot,
): unknown => ordered(snapshot);
