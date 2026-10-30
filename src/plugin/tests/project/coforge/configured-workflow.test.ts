import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  createSeed,
} from "../../../features/coforge/domain/seed";
import {
  defaultWorkflowDefinition,
  parseWorkflowDefinition,
  serializeWorkflowDefinition,
  workflowDefinitionCheck,
  workflowStepCheck,
  WORKFLOW_OUTPUTS,
} from "../../../features/coforge/domain/configured-workflow";
import {
  workflowArtifactCheck,
  workflowArtifactHash,
  workflowProposalRevision,
} from "../../../features/coforge/domain/configured-workflow-run";

describe("portable ordered workflow contracts", () => {
  it('accepts all current input roles for AI, nudge and Council steps without changing legacy Markdown contracts', () => {
    const definition = defaultWorkflowDefinition(defaultSettings());
    const base = { id: 'consumer', name: 'Consume earlier results', instructions: 'Inspect earlier results', inputs: [...WORKFLOW_OUTPUTS] };
    const consumer = { ...base, kind: 'ai', output: 'markdown', access: 'none', provider: 'demo', model: 'sonnet', automatic: false };
    expect(workflowStepCheck(consumer).kind).toBe('ai');
    expect(workflowStepCheck({ ...base, kind: 'nudge', teamId: 'team', agentId: 'agent' }).kind).toBe('nudge');
    expect(workflowStepCheck({ ...base, kind: 'council', councilId: 'council', automatic: false }).kind).toBe('council');
    const legacy = { ...definition, revision: 'saved-legacy', steps: [{ ...consumer, inputs: [] }] };
    expect(parseWorkflowDefinition(JSON.stringify(legacy))).toMatchObject({ revision: 'saved-legacy', steps: [{ output: 'markdown', inputs: [] }] });
    const value = { id: 'old-artifact', runId: 'run', stepId: 'old-step', attemptId: 'old-attempt', proposalRevision: 'proposal', output: 'markdown' as const, markdown: '# Older report', createdAt: '2026-10-28T10:00:00Z' };
    expect(workflowArtifactCheck({ ...value, contentHash: workflowArtifactHash(value) }).output).toBe('markdown');
    const blank = { ...value, output: 'design' as const, markdown: ' \n\t ' };
    expect(() => workflowArtifactCheck({ ...blank, contentHash: workflowArtifactHash(blank) })).toThrow('contain Markdown text');
  });
  it("materializes legacy choices without modifying settings and permits replacement/repeated arbitrary roles", () => {
    const settings = defaultSettings();
    const before = structuredClone(settings);
    const legacy = defaultWorkflowDefinition(settings);
    expect(legacy.steps.map((step) => step.id)).toEqual([
      "screen",
      "score",
      "plan",
      "design",
      "implement",
    ]);
    expect(defaultWorkflowDefinition(settings)).toEqual(legacy);
    expect(settings).toEqual(before);
    const step = legacy.steps[0]!;
    if (step.kind !== "ai") throw new Error("Expected AI default");
    const definition = {
      ...legacy,
      steps: [
        { ...step, id: "second", output: "markdown" as const },
        { ...step, id: "first", output: "markdown" as const },
      ],
    };
    expect(
      parseWorkflowDefinition(serializeWorkflowDefinition(definition)),
    ).toEqual(definition);
  });
  it("rejects duplicate identities, unknown host flags and unavailable required inputs", () => {
    const definition = defaultWorkflowDefinition(defaultSettings());
    const step = definition.steps[0]!;
    expect(() =>
      workflowDefinitionCheck({ ...definition, steps: [step, step] }),
    ).toThrow("unique");
    expect(() =>
      workflowDefinitionCheck({ ...definition, shell: true }),
    ).toThrow();
    expect(() =>
      workflowDefinitionCheck({
        ...definition,
        steps: [{ ...step, inputs: ["plan"] }],
      }),
    ).toThrow("preceding");
  });
  it("keeps proposal revision independent of workflow results/status while detecting viewer changes", () => {
    const idea = createSeed().ideas[0]!;
    const revision = workflowProposalRevision(idea);
    expect(
      workflowProposalRevision({
        ...idea,
        status: "review",
        rice: undefined,
        plan: undefined,
      }),
    ).toBe(revision);
    expect(
      workflowProposalRevision({
        ...idea,
        description: `${idea.description} changed`,
      }),
    ).not.toBe(revision);
  });
  it("detects artifact tampering with stable order-independent content fingerprints", () => {
    const value = {
      id: "artifact",
      runId: "run",
      stepId: "step",
      attemptId: "attempt",
      proposalRevision: "proposal",
      output: "markdown" as const,
      createdAt: "2026-10-28T10:00:00Z",
      markdown: "# Result",
    };
    const contentHash = workflowArtifactHash(value);
    expect(workflowArtifactCheck({ ...value, contentHash }).markdown).toBe(
      "# Result",
    );
    expect(() =>
      workflowArtifactCheck({ ...value, contentHash, markdown: "Tampered" }),
    ).toThrow("changed");
    expect(
      workflowArtifactHash({
        markdown: value.markdown,
        createdAt: value.createdAt,
        output: value.output,
        proposalRevision: value.proposalRevision,
        attemptId: value.attemptId,
        stepId: value.stepId,
        runId: value.runId,
        id: value.id,
      }),
    ).toBe(contentHash);
  });
});
