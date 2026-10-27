import { describe, expect, it } from "vitest";
import { stageSystemPrompt } from "../../../features/coforge/application/agent-prompts";
import { buildClaudeArgs } from "../../../features/coforge/application/claude-protocol";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import {
  applyProjectProperties,
  parseProjectNote,
  projectProperties,
} from "../../../features/coforge/domain/project-note";
import { defaultStagePrompt } from "../../../features/coforge/domain/stage-prompts";
describe("project-specific workflow prompts", () => {
  it("round-trips sparse stage overrides in project frontmatter and removes a reset without touching unrelated fields", () => {
    const project = {
      id: "CFP-001",
      settings: {
        ...defaultSettings(),
        stagePrompts: {
          implement: "Use small commits.\nKeep the interface accessible.",
        },
      },
      projectPath: "/project",
      worktreeFolder: "",
      allowImplementation: false,
      repositoryUrl: "",
      websiteUrl: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const frontmatter = { ...projectProperties(project), custom: "Keep me" };
    expect(
      parseProjectNote(frontmatter)?.settings.stagePrompts?.implement,
    ).toBe(project.settings.stagePrompts.implement);
    applyProjectProperties(frontmatter, {
      ...project,
      settings: {
        ...project.settings,
        stagePrompts: { implement: defaultStagePrompt("implement") },
      },
    });
    expect(parseProjectNote(frontmatter)?.settings.stagePrompts).toEqual({});
    expect(frontmatter.custom).toBe("Keep me");
  });
  it("applies only the selected project stage override while retaining execution contracts", () => {
    const settings = {
      ...defaultSettings(),
      stagePrompts: {
        screen: "PROJECT_SCREEN_POLICY: explain product fit.",
        plan: "PROJECT_PLAN_POLICY: use small increments.",
      },
    };
    expect(stageSystemPrompt("screen", settings)).toContain(
      "PROJECT_SCREEN_POLICY",
    );
    expect(stageSystemPrompt("screen", settings)).not.toContain(
      "PROJECT_PLAN_POLICY",
    );
    expect(stageSystemPrompt("score", settings)).toBe(
      stageSystemPrompt("score"),
    );
    const args = buildClaudeArgs("screen", settings);
    expect(args[args.indexOf("--system-prompt") + 1]).toContain(
      "PROJECT_SCREEN_POLICY",
    );
    expect(args).toContain("--restricted");
    expect(args).toContain("--json-schema");
    expect(args[args.indexOf("--tools") + 1]).toBe("");
  });
});
