import { expect, it } from "vitest";
import {
  stageAgentDrafts,
  stageAgentOverrides,
} from "../../../presentation/stores/coforge-stage-agent-draft";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import {
  stageAgentLabel,
  workflowProviderSummary,
} from "../../../presentation/composables/coforge/agent-labels";
it("preserves optional Herdr agent overrides without changing legacy draft shape", () => {
  expect(stageAgentDrafts().screen).toEqual({ provider: "", model: "" });
  const drafts = stageAgentDrafts({
    screen: { provider: "herdr", herdrAgent: "claude", model: "sonnet" },
  });
  expect(drafts.screen.herdrAgent).toBe("claude");
  expect(stageAgentOverrides(drafts)).toEqual({
    screen: { provider: "herdr", herdrAgent: "claude", model: "sonnet" },
  });
});
it("labels Herdr workflow attempts accurately without calling them native Claude or Simulation", () => {
  const settings = { ...defaultSettings(), provider: "herdr" as const };
  expect(stageAgentLabel(settings, "screen")).toBe(
    "Herdr · Claude Code · sonnet",
  );
  expect(workflowProviderSummary(settings).label).toBe("Herdr");
});
import { workflowStageProblem } from "../../../presentation/composables/coforge/workflow-readiness";
import type { StudioProject } from "../../../features/coforge/domain/types";
it("gates Herdr on its workflow capability and project path independently of native Claude discovery", () => {
  const settings = { ...defaultSettings(), provider: "herdr" as const };
  const project: StudioProject = {
    id: "CFP-001",
    settings,
    projectPath: "/synthetic/game",
    worktreeFolder: "",
    repositoryUrl: "",
    websiteUrl: "",
    allowImplementation: false,
    createdAt: "",
    updatedAt: "",
  };
  const runtime = {
    cliAvailable: false,
    projectPath: null,
    allowImplementation: false,
    chatSource: "simulator" as const,
    chatStatus: "",
    herdrWorkflow: { ready: true, busy: false, message: "" },
  };
  expect(workflowStageProblem(settings, "screen", project, runtime)).toBe("");
  expect(
    workflowStageProblem(
      settings,
      "screen",
      { ...project, projectPath: "" },
      runtime,
    ),
  ).toContain("workspace");
  expect(
    workflowStageProblem(settings, "implement", project, runtime),
  ).toContain("permission");
  expect(
    workflowStageProblem(settings, "screen", project, {
      ...runtime,
      herdrWorkflow: undefined,
    }),
  ).toContain("Herdr workflow is unavailable");
  expect(
    workflowStageProblem(settings, "screen", project, {
      ...runtime,
      herdrWorkflow: { ready: true, busy: true, message: "" },
    }),
  ).toContain("another workflow attempt");
});
