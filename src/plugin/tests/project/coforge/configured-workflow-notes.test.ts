import { describe, expect, it } from "vitest";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import {
  workflowArtifactHash,
  type WorkflowRun,
} from "../../../features/coforge/domain/configured-workflow-run";
import {
  ideaBody,
  ideaProperties,
  parseIdeaNote,
} from "../../../features/coforge/domain/idea-note";
import {
  applyProjectProperties,
  parseProjectNote,
  projectProperties,
} from "../../../features/coforge/domain/project-note";
import { parsePersistedStudio } from "../../../features/coforge/domain/persisted";
import { copySettings } from "../../../features/coforge/domain/projects";
import { seededStore } from "./memory-storage";

export function manualWorkflowRun(ideaId = "CF-107"): WorkflowRun {
  const now = new Date().toISOString();
  return {
    id: "run-one",
    ideaId,
    projectId: "CFP-001",
    definition: {
      format: "coforge-workflow/v1",
      revision: "definition-one",
      name: "Review process",
      limits: {
        timeoutSeconds: 30,
        maxTurns: 5,
        maxBudgetUsd: 1,
        intervalSeconds: 10,
      },
      steps: [
        {
          id: "review",
          name: "Review",
          kind: "approval",
          instructions: "Read **this** and {{keep}}.",
        },
      ],
    },
    proposalRevision: "proposal-one",
    revision: 1,
    cursor: 0,
    state: "waiting-human",
    attempts: [
      {
        id: "manual-one",
        stepId: "review",
        stepName: "Review",
        kind: "approval",
        status: "waiting-human",
        inputs: [],
        startedAt: now,
      },
    ],
    artifacts: [],
    activeAttemptId: "manual-one",
    createdAt: now,
    updatedAt: now,
  };
}

describe("canonical workflow note and plugin-state codecs", () => {
  it("round-trips a project definition and its prompts while preserving unknown frontmatter", async () => {
    const { store } = await seededStore();
    const project = store.snapshot().projects![0]!;
    project.settings.workflow = {
      ...defaultWorkflowDefinition(project.settings),
      name: "Design {{and}} build",
    };
    project.settings.workflow.steps[0]!.instructions =
      "Inspect `code` and [[references]]\n\nKeep this exact prompt.";
    const properties = {
      ...projectProperties(project),
      custom: "Keep annotations",
    };
    expect(parseProjectNote(properties)?.settings.workflow).toEqual(
      project.settings.workflow,
    );
    const copy = copySettings(project.settings);
    copy.workflow!.steps[0]!.name = "Changed copy";
    expect(project.settings.workflow.steps[0]!.name).not.toBe("Changed copy");
    applyProjectProperties(properties, {
      ...project,
      settings: { ...project.settings, workflow: undefined },
    });
    expect(properties).not.toHaveProperty("workflow-definition");
    expect(properties.custom).toBe("Keep annotations");
  });
  it("preserves manual checkpoints and prior runs without normalizing their captured payloads", async () => {
    const { store } = await seededStore();
    const idea = store.snapshot().ideas.find((idea) => idea.id === "CF-107")!;
    idea.workflowRun = manualWorkflowRun(idea.id);
    idea.workflowHistory = [
      { ...manualWorkflowRun(idea.id), id: "prior-run", state: "stopped" },
    ];
    const restored = parseIdeaNote(
      ideaProperties(idea, "Fixture author"),
      ideaBody(idea),
    );
    expect(restored.workflowRun).toEqual(idea.workflowRun);
    expect(restored.workflowHistory).toEqual(idea.workflowHistory);
  });
  it("retains the pinned step on queued job reload", async () => {
    const { store, storage } = await seededStore();
    const definition = defaultWorkflowDefinition(store.snapshot().settings);
    const step = definition.steps.find((step) => step.kind === "ai")!;
    if (step.kind !== "ai") throw new Error("Expected an AI fixture");
    await store.transaction((state) => {
      state.jobs.push({
        id: "job-one",
        ideaId: "CF-107",
        projectId: "CFP-001",
        stage: "screen",
        provider: step.provider,
        model: step.model,
        status: "queued",
        startedAt: new Date().toISOString(),
        logs: [],
        workflow: {
          runId: "run-one",
          definitionRevision: definition.revision,
          proposalRevision: "proposal-one",
          attemptId: "attempt-one",
          step,
          inputArtifacts: [],
        },
      });
    });
    const loaded = await storage.load();
    expect(parsePersistedStudio(loaded.data).jobs.at(-1)?.workflow).toEqual(
      store.snapshot().jobs.at(-1)?.workflow,
    );
  });
  it("preserves artifact bytes and their hash through template-safe note serialization", async () => {
    const { store } = await seededStore();
    const idea = store.snapshot().ideas.find((idea) => idea.id === "CF-107")!;
    const run = manualWorkflowRun(idea.id);
    run.definition.steps.unshift({
      id: "analysis",
      name: "Analysis",
      kind: "ai",
      output: "markdown",
      access: "none",
      provider: "demo",
      model: "sonnet",
      automatic: false,
      instructions: "Analyze.",
    });
    run.cursor = 1;
    run.attempts.unshift({
      id: "analysis-attempt",
      stepId: "analysis",
      stepName: "Analysis",
      kind: "ai",
      status: "succeeded",
      inputs: [],
      startedAt: run.createdAt,
      finishedAt: run.updatedAt,
    });
    const payload = {
      id: "artifact-one",
      runId: run.id,
      stepId: "analysis",
      attemptId: "analysis-attempt",
      proposalRevision: run.proposalRevision,
      output: "markdown" as const,
      createdAt: run.updatedAt,
      markdown: "Code  `x`\r\n\r\n{{keep}} and e\u0301. Original joiner \u2060; path C:\\code\\file.",
    };
    run.artifacts.push({
      ...payload,
      contentHash: workflowArtifactHash(payload),
    });
    idea.workflowRun = run;
    const restored = parseIdeaNote(
      ideaProperties(idea, "Fixture author"),
      ideaBody(idea),
    );
    expect(restored.workflowRun?.artifacts).toEqual(run.artifacts);
  });
});
