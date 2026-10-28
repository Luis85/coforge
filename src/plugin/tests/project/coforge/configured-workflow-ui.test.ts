import { expect, it } from "vitest";
import { configuredStepProblem } from "../../../presentation/composables/coforge/configured-workflow-display";
import {
  defaultSettings,
  defaultRuntime,
} from "../../../features/coforge/domain/seed";
import type { StudioProject } from "../../../features/coforge/domain/types";
import type { AiWorkflowStep } from "../../../features/coforge/domain/configured-workflow";
it("allows an isolated Herdr step without a project path while repository access still requires one", () => {
  const project: StudioProject = {
    id: "CFP-001",
    settings: defaultSettings(),
    projectPath: "",
    worktreeFolder: "",
    repositoryUrl: "",
    websiteUrl: "",
    allowImplementation: false,
    createdAt: "",
    updatedAt: "",
  };
  const step: AiWorkflowStep = {
    id: "classify",
    name: "Classify request",
    instructions: "",
    kind: "ai",
    output: "screening",
    access: "none",
    provider: "herdr",
    model: "sonnet",
    automatic: false,
  };
  const runtime = {
    ...defaultRuntime(),
    cliAvailable: false,
    herdrWorkflow: { ready: true, busy: false, message: "" },
  };
  expect(configuredStepProblem(step, project, runtime)).toBe("");
  expect(
    configuredStepProblem({ ...step, access: "readproject" }, project, runtime),
  ).toContain("project path");
});
