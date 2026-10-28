import { oneOf, optional, shape, text } from "./check";
import { requestCategoriesCheck } from './request-categories';
import { cleanLine, cleanText, defangProperty } from "./sanitize";
import { workflowNoteData } from "./workflow-note-data";
import {
  requestObjectDefinitionCheck,
  requestObjectFieldsCheck,
  requestObjectValuesCheck,
  type RequestObjectSnapshot,
} from "./request-object";

export const REQUEST_CLASS_PROPERTY = "request-class";
export const REQUEST_SCHEMA_PROPERTY = "coforge-request-schema";
const schemaCheck = shape(
  {
    format: oneOf(["coforge-request-schema/v1"]),
    fields: requestObjectFieldsCheck,
    categories: optional(requestCategoriesCheck),
  },
  { strict: true },
);
export const requestObjectFromProperties = (
  properties: Record<string, unknown>,
): RequestObjectSnapshot | undefined => {
  if (properties[REQUEST_SCHEMA_PROPERTY] === undefined) return undefined;
  const schema = schemaCheck(properties[REQUEST_SCHEMA_PROPERTY]);
  const className = text({ max: 80 })(
    cleanLine(text({ max: 500 })(properties[REQUEST_CLASS_PROPERTY] ?? "")),
  );
  const values = Object.fromEntries(
    schema.fields
      .filter((field) => Object.hasOwn(properties, field.key))
      .map((field) => {
        const value = properties[field.key];
        return [
          field.key,
          typeof value === "string" ? cleanText(value) : value,
        ];
      }),
  );
  return {
    className,
    fields: schema.fields,
    ...(schema.categories ? { categories: schema.categories } : {}),
    values: requestObjectValuesCheck(schema.fields, values),
  };
};
export function requestObjectNoteProperties(
  snapshot: RequestObjectSnapshot,
): Record<string, unknown> {
  const definition = requestObjectDefinitionCheck({
    format: "coforge-request-object/v1",
    className: snapshot.className,
    fields: snapshot.fields,
    ...(snapshot.categories ? { categories: snapshot.categories } : {}),
  });
  const fields = definition.fields;
  const values = requestObjectValuesCheck(fields, snapshot.values);
  return {
    ...(definition.className
      ? { [REQUEST_CLASS_PROPERTY]: defangProperty(definition.className) }
      : {}),
    [REQUEST_SCHEMA_PROPERTY]: workflowNoteData({
      format: "coforge-request-schema/v1",
      fields,
      ...(definition.categories ? { categories: definition.categories } : {}),
    }),
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === "string" ? defangProperty(value) : value,
      ]),
    ),
  };
}
export function requestObjectPropertyKeys(
  snapshot: RequestObjectSnapshot | undefined,
): string[] {
  return snapshot
    ? [
        REQUEST_CLASS_PROPERTY,
        REQUEST_SCHEMA_PROPERTY,
        ...snapshot.fields.map((field) => field.key),
      ]
    : [];
}
