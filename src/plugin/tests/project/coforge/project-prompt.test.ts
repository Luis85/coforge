import { describe, expect, it } from "vitest";
import { createSeed, defaultIntegration, defaultSettings } from "../../../features/coforge/domain/seed";
import { initialProject } from "../../../features/coforge/domain/projects";
import { projectProperties, parseProjectNote } from "../../../features/coforge/domain/project-note";
import { stageInput } from "../../../features/coforge/application/agent-prompts";
import { buildClaudeArgs } from "../../../features/coforge/application/claude-protocol";

describe("parent-project agent instructions", () => {
  it("round-trips a separate general prompt through canonical project frontmatter", () => {
    const project = initialProject(
      { ...defaultSettings(), agentPrompt: "Use Rust and Bevy. Keep increments small." },
      defaultIntegration(),
      new Date().toISOString(),
    );
    const properties = projectProperties(project);
    expect(properties["agent-prompt"]).toBe("Use Rust and Bevy. Keep increments small.");
    expect(parseProjectNote(properties)?.settings.agentPrompt).toBe(project.settings.agentPrompt);
  });
  it("prefixes every stage input without putting the project prompt into process arguments or widening tools", () => {
    const settings = { ...defaultSettings(), agentPrompt: "Use the project conventions and write concise changes." };
    const idea = createSeed().ideas[0]!;
    for (const stage of ["screen", "score", "plan", "implement"] as const) {
      expect(stageInput(stage, idea, settings).startsWith(settings.agentPrompt + "\n\n")).toBe(true);
      expect(buildClaudeArgs(stage, settings)).not.toContain(settings.agentPrompt);
    }
  });
});
