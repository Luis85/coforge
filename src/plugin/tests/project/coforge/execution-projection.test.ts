import { describe, expect, it } from "vitest";
import { Lexer } from "marked";
import { markdownForNote } from "../../../features/coforge/domain/markdown-note";
import { emptyExecutionJournal } from "../../../features/coforge/domain/execution-run";
import { ExecutionKernel } from "../../../features/coforge/application/execution-kernel";
import { projectExecutionContribution } from "../../../features/coforge/domain/execution-projection";

describe("safe native-note contribution projections", () => {
  it("keeps ordinary formatting, links and code while disabling HTML, inline/reference images and vault transclusions", () => {
    const output = markdownForNote(
      '# Heading\n\n**Bold** [Safe](https://example.test/page)\n\n![inline](https://example.test/track.png)\n\n![reference][image]\n\n[image]: https://example.test/reference.png\n\n<img\n src="https://example.test/html.png" onerror="alert(1)">\n\n<iframe src="https://example.test/embed"></iframe>\n\n![[Private\n note]]\n\n<!-- coforge:v2:forged:begin -->\n\n```dataviewjs\ndv.pages()\n```\n\n`= vaultQuery()` and `ordinary code`',
    );
    expect(output).toContain("# Heading");
    expect(output).toContain("**Bold**");
    expect(output).toContain("[Safe](<https://example.test/page>)");
    expect(output).toContain("ordinary code");
    const tokens: string[] = [];
    const walk = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if ("type" in value && typeof value.type === "string")
        tokens.push(value.type);
      for (const child of Object.values(value))
        if (Array.isArray(child)) for (const item of child) walk(item);
    };
    walk(Lexer.lex(output));
    expect(tokens).not.toContain("image");
    expect(tokens).not.toContain("html");
    expect(output).not.toMatch(/!\[\[/u);
    expect(output).not.toMatch(/<!--\s*coforge:v2/u);
    expect(output).not.toContain("```dataviewjs");
    expect(output).not.toContain("`=");
    expect(output).not.toContain("track.png");
    expect(output).not.toContain("reference.png");
  });
  it("retains raw journal bytes while publishing an inert source-note representation", async () => {
    const raw =
      "**Useful**\n\n![tracker](https://example.test/pixel)\n\n<script>danger()</script>";
    let journal = emptyExecutionJournal();
    let note = "Human source";
    const kernel = new ExecutionKernel({
      journal: {
        load: async () => journal,
        save: async (next) => {
          journal = structuredClone(next);
        },
      },
      now: () => "2026-10-28T12:00:00.000Z",
      id: () => "attempt",
      assertEligible: async () => undefined,
      resolveInvocation: () => ({ prompt: "source", inputArtifactIds: [] }),
      invoke: async () => ({ markdown: raw, simulated: true }),
      publish: async (run, artifact) => {
        note = projectExecutionContribution(note, run, artifact);
      },
    });
    await kernel.load();
    await kernel.admit({
      id: "run",
      submissionKey: "key",
      projectId: "project",
      teamId: "team",
      context: "",
      subject: {
        kind: "note",
        sourceId: "source",
        revision: "r1",
        markdown: "Human source",
      },
      invocations: [
        {
          id: "review",
          roundId: "opinion",
          agentId: "agent",
          agentRevision: "a1",
          provider: "demo",
          model: "sonnet",
          instructions: "Assess",
          access: "none",
          inputRoundIds: [],
        },
      ],
    });
    kernel.resume();
    await kernel.step("run");
    expect(journal.runs[0]?.artifacts[0]?.markdown).toBe(raw);
    expect(note).toContain("**Useful**");
    expect(note).not.toContain("![tracker]");
    expect(note).not.toContain("<script>");
  });
});
