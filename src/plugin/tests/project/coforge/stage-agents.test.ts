import { describe, expect, it } from "vitest";
import {
  stageAgent,
  normalizeStageAgents,
  hasClaudeStages,
} from "../../../features/coforge/domain/stage-agents";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { settingsPatch } from "../../../features/coforge/domain/inputs";
import { copySettings } from "../../../features/coforge/domain/projects";
import {
  applyProjectProperties,
  parseProjectNote,
  projectProperties,
} from "../../../features/coforge/domain/project-note";
import {
  STAGES,
  type StudioProject,
} from "../../../features/coforge/domain/types";
describe("per-step agent settings", () => {
  it("inherits provider and model independently and retains explicit overrides equal to defaults", () => {
    const settings = {
      ...defaultSettings(),
      provider: "demo" as const,
      model: "project-model",
      stageAgents: {
        screen: { provider: "claude" as const },
        score: { model: "score-model" },
        implement: { provider: "demo" as const, model: "project-model" },
      },
    };
    expect(stageAgent(settings, "screen")).toEqual({
      provider: "claude",
      model: "project-model",
    });
    expect(stageAgent(settings, "score")).toEqual({
      provider: "demo",
      model: "score-model",
    });
    expect(stageAgent(settings, "plan")).toEqual({
      provider: "demo",
      model: "project-model",
    });
    expect(normalizeStageAgents(settings.stageAgents).implement).toEqual({
      provider: "demo",
      model: "project-model",
    });
    expect(hasClaudeStages(settings)).toBe(true);
    const copied = copySettings(settings);
    copied.stageAgents!.screen!.provider = "demo";
    expect(settings.stageAgents.screen.provider).toBe("claude");
  });
  it("rejects unknown stages/providers and model flags instead of silently falling back", () => {
    for (const input of [
      { stageAgents: { screen: { provider: "openai" } } },
      { stageAgents: { unknown: { provider: "claude" } } },
      { stageAgents: { plan: { model: "--dangerous" } } },
      { stageAgents: { implement: { model: "bad model" } } },
      { stageAgents: { screen: { model: "" } } },
    ])
      expect(() => settingsPatch(input)).toThrow();
    expect(normalizeStageAgents({ screen: {} })).toEqual({});
  });
  it("round-trips flat Obsidian frontmatter, resets only owned fields and preserves legacy defaults", () => {
    const now = new Date().toISOString();
    const project: StudioProject = {
      id: "CFP-001",
      settings: {
        ...defaultSettings(),
        stageAgents: {
          screen: { provider: "claude", model: "haiku" },
          implement: { provider: "demo" },
        },
      },
      projectPath: "/project",
      worktreeFolder: "",
      repositoryUrl: "",
      websiteUrl: "",
      allowImplementation: false,
      createdAt: now,
      updatedAt: now,
    };
    const properties = { ...projectProperties(project), custom: "Keep me" };
    expect(properties).toMatchObject({
      "agent-provider-screen": "claude",
      "agent-model-screen": "haiku",
      "agent-provider-implement": "demo",
    });
    expect(parseProjectNote(properties)?.settings.stageAgents).toEqual(
      project.settings.stageAgents,
    );
    applyProjectProperties(properties, {
      ...project,
      settings: { ...project.settings, stageAgents: {} },
    });
    expect(properties).not.toHaveProperty("agent-provider-screen");
    expect(properties).not.toHaveProperty("agent-model-screen");
    expect(properties.custom).toBe("Keep me");
    const legacy = parseProjectNote(properties)!;
    for (const stage of STAGES)
      expect(stageAgent(legacy.settings, stage)).toEqual({
        provider: legacy.settings.provider,
        model: legacy.settings.model,
      });
  });
});
