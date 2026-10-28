import { expect, it } from "vitest";
import { workflowSerializedSize } from "../../../features/coforge/domain/configured-workflow-run";

it.each([
  undefined,
  { markdown: "An ASCII proposal", instructions: 'quoted "value" and \\ path' },
  { markdown: "日本語 中文 Ελληνικά café" },
  { markdown: "A lantern 😀 with music 🎵" },
  { markdown: "\ud800 isolated surrogate \udfff" },
  { controls: "\u0000\n\r\t\b", nested: [{ text: "混合 mixed 😀" }] },
  { markdown: '"\\'.repeat(500000) },
])(
  "measures exact serialized UTF-8 bytes for ASCII fast paths and Unicode fallbacks",
  (value) => {
    expect(workflowSerializedSize(value)).toBe(
      Buffer.byteLength(JSON.stringify(value) ?? "", "utf8"),
    );
  },
);
