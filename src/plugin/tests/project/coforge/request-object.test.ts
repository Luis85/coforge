import { expect, it } from "vitest";
import {
  captureRequestObject,
  requestObjectDefinitionCheck,
  requestObjectValuesCheck,
  requestObjectRevision,
} from "../../../features/coforge/domain/request-object";

import { objectDefinition } from "./request-object-fixture";
import { reactive } from "vue";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { copySettings } from "../../../features/coforge/domain/projects";
import {
  requestObjectFromProperties,
  requestObjectNoteProperties,
} from "../../../features/coforge/domain/request-object-note";

it("captures typed optional defaults and values without sharing the live project schema", () => {
  const definition = objectDefinition();
  const snapshot = captureRequestObject(definition, {
    customer: "Studio",
    "target-date": "2026-10-28",
    priority: "High",
  });
  expect(snapshot).toMatchObject({
    className: "Business Idea",
    values: {
      "business-value": 0,
      validated: false,
      customer: "Studio",
      "target-date": "2026-10-28",
      priority: "High",
    },
  });
  definition.className = "Feature Idea";
  definition.fields.splice(0, 1);
  expect(snapshot?.className).toBe("Business Idea");
  expect(snapshot?.fields).toHaveLength(5);
  expect(captureRequestObject(undefined)).toBeUndefined();
});

it.each([
  "id",
  "status",
  "type",
  "screening",
  "workflow-run",
  "coforge-project",
  "coforge_task",
  "request-class",
  "__proto__",
  "constructor",
  "prototype",
  "tags",
  "project-path",
])("rejects reserved custom property key %s", (key) => {
  expect(() =>
    requestObjectDefinitionCheck({
      format: "coforge-request-object/v1",
      className: "Idea",
      fields: [{ key, label: "Unsafe", type: "text" }],
    }),
  ).toThrow();
});

it("rejects duplicate keys, unsupported field contracts, invalid defaults and malformed typed values", () => {
  const definition = objectDefinition();
  expect(() =>
    requestObjectDefinitionCheck({
      ...definition,
      fields: [
        { key: "priority", label: "First", type: "text" },
        { key: "PRIORITY", label: "Second", type: "text" },
      ],
    }),
  ).toThrow(/unique|duplicate/iu);
  expect(() =>
    requestObjectDefinitionCheck({
      ...definition,
      fields: [{ key: "extra", label: "Extra", type: "script" }],
    }),
  ).toThrow();
  expect(() =>
    requestObjectDefinitionCheck({
      ...definition,
      fields: [
        { key: "extra", label: "Extra", type: "number", defaultValue: "100" },
      ],
    }),
  ).toThrow();
  expect(() =>
    requestObjectDefinitionCheck({
      ...definition,
      fields: [{ key: "extra", label: "Extra", type: "text", required: true }],
    }),
  ).toThrow();
  for (const values of [
    { "business-value": "10" },
    { "target-date": "2026-02-30" },
    { validated: "true" },
    { priority: "Urgent" },
    { unknown: "drop me" },
  ])
    expect(() => requestObjectValuesCheck(definition.fields, values)).toThrow();
  expect(requestObjectValuesCheck(definition.fields, {})).toEqual({});
});

it("uses a deterministic configuration revision for stale form guards", () => {
  const definition = objectDefinition();
  const revision = requestObjectRevision(definition);
  expect(requestObjectRevision(structuredClone(definition))).toBe(revision);
  definition.fields[0]!.label = "Expected benefit";
  expect(requestObjectRevision(definition)).not.toBe(revision);
});

it("copies reactive project definitions through typed parsing without retaining proxies or shared fields", () => {
  const settings = reactive({
    ...defaultSettings(),
    requestObject: objectDefinition(),
  });
  const copy = copySettings(settings);
  expect(copy.requestObject).toEqual(objectDefinition());
  settings.requestObject.fields[0]!.label = "Changed in the reactive form";
  expect(copy.requestObject?.fields[0]?.label).toBe("Business value");
});

it("reads host Date properties and maximum-length defanged text without losing typed defaults", () => {
  const definition = requestObjectDefinitionCheck({
    format: "coforge-request-object/v1",
    className: "`".repeat(80),
    fields: [
      {
        key: "target-date",
        label: "Target date",
        type: "date",
        defaultValue: new Date("2026-10-28T00:00:00Z"),
      },
      {
        key: "details",
        label: "Details",
        type: "text",
        defaultValue: "`".repeat(2000),
      },
    ],
  });
  const snapshot = captureRequestObject(definition);
  if (!snapshot) throw new Error("Missing snapshot");
  const properties = requestObjectNoteProperties(snapshot);
  properties["target-date"] = new Date("2026-10-28T00:00:00Z");
  expect(requestObjectFromProperties(properties)).toEqual(snapshot);
});
