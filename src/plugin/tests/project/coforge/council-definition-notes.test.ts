import { describe, expect, it } from "vitest";
import {
  agentDefinitionCheck,
  definitionRevision,
} from "../../../features/coforge/domain/council-definitions";
import {
  readCouncilDefinitionNote,
  writeCouncilDefinitionNote,
  duplicateCouncilDefinition,
  indexCouncilDefinitions,
} from "../../../infrastructure/coforge/council-definition-notes";

const agent = () =>
  agentDefinitionCheck({
    schema: "agent/v1",
    id: "architect",
    name: "Architect",
    enabled: true,
    role: "Architecture",
    instructions: "Read **carefully**.\n\n## Nested instruction\nKeep this.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  });

describe("canonical reusable definition notes", () => {
  it('round-trips explicit model effort with a new definition revision', () => {
    const legacy = agent();
    const revised = { ...legacy, provider: 'claude' as const, model: 'claude-opus-4-6', effort: 'max' as const };
    const written = writeCouncilDefinitionNote('', revised);
    expect(readCouncilDefinitionNote(written)).toMatchObject(revised);
    expect(definitionRevision(revised)).not.toBe(definitionRevision(legacy));
  });
  it("round-trips body instructions and preserves exact unrelated frontmatter and text on edits", () => {
    const original =
      '---\r\ncustom: "Exact quoted value" # retain me\r\nx-organization:\r\n  field:   true\r\n---\r\n# Human introduction\r\n\r\nKeep my annotation.\r\n';
    const created = writeCouncilDefinitionNote(original, agent());
    expect(created).toContain(
      'custom: "Exact quoted value" # retain me\r\nx-organization:\r\n  field:   true\r\n',
    );
    expect(created).toContain(
      "# Human introduction\r\n\r\nKeep my annotation.\r\n",
    );
    expect(readCouncilDefinitionNote(created)).toEqual(agent());
    const edited = {
      ...agent(),
      name: "Renamed architect",
      instructions: "Updated guidance.",
    };
    const saved = writeCouncilDefinitionNote(created, edited);
    expect(readCouncilDefinitionNote(saved)).toEqual(edited);
    expect(saved).toContain('custom: "Exact quoted value" # retain me\r\n');
    expect(saved).toContain("Keep my annotation.\r\n");
    expect(saved.match(/coforge:instructions:start/gu)).toHaveLength(1);
  });

  it("preserves identity through moves, assigns duplication identity and reports copied-ID conflicts", () => {
    const markdown = writeCouncilDefinitionNote("", agent());
    const first = indexCouncilDefinitions([
      { path: "Agents/First.md", markdown },
    ]);
    const moved = indexCouncilDefinitions([
      { path: "Elsewhere/Renamed.md", markdown },
    ]);
    expect(first.valid[0]!.revision).toBe(moved.valid[0]!.revision);
    expect(first.valid[0]!.revision).toBe(definitionRevision(agent()));
    const copied = duplicateCouncilDefinition(agent(), "architect-copy");
    expect(copied.id).toBe("architect-copy");
    expect(copied.enabled).toBe(false);
    const conflict = indexCouncilDefinitions([
      { path: "one.md", markdown },
      { path: "two.md", markdown },
    ]);
    expect(conflict.valid).toEqual([]);
    expect(conflict.invalid).toHaveLength(2);
  });

  it("rejects malformed YAML, aliases, duplicate reserved keys and unsupported reserved fields", () => {
    expect(() => readCouncilDefinitionNote("---\ncoforge: [\n---\n")).toThrow();
    expect(() =>
      readCouncilDefinitionNote(
        "---\nx: &x {schema: agent/v1}\ncoforge: *x\n---\n",
      ),
    ).toThrow();
    const note = writeCouncilDefinitionNote("", agent());
    expect(() =>
      readCouncilDefinitionNote(
        note.replace(
          "schema: agent/v1",
          "schema: agent/v1\n  secret: forbidden",
        ),
      ),
    ).toThrow();
    expect(() =>
      readCouncilDefinitionNote(
        note.replace(
          "schema: agent/v1",
          "schema: agent/v1\n  instructions: Conflicting YAML instructions",
        ),
      ),
    ).toThrow(/body/i);
    expect(() =>
      writeCouncilDefinitionNote(note, { ...agent(), id: "different" }),
    ).toThrow(/identity/i);
  });
  it("preserves frontmatter comments and scalar spelling after the reserved block", () => {
    const created = writeCouncilDefinitionNote("", agent());
    const source = created.replace(
      "\n---\n",
      '\n# A human property follows\ncustom:   "keep my spelling" # keep comment\n---\n',
    );
    const saved = writeCouncilDefinitionNote(source, {
      ...agent(),
      role: "Updated role",
    });
    expect(saved).toContain(
      '# A human property follows\ncustom:   "keep my spelling" # keep comment\n',
    );
  });
});
