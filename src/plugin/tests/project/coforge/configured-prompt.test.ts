import { expect, it } from "vitest";
import {
  executionTaskPrompt,
  executionSystemPrompt,
} from "../../../features/coforge/application/workflow-execution";
import type { StageInput } from "../../../features/coforge/application/ports";
import {
  workflowArtifactHash,
  type WorkflowArtifact,
} from "../../../features/coforge/domain/configured-workflow-run";
import { record } from "../../../features/coforge/domain/check";
import {
  createSeed,
  defaultSettings,
  defaultIntegration,
} from "../../../features/coforge/domain/seed";
it.each(["rice", "plan", "design", "codechange"] as const)(
  "sends bounded streamer retry feedback and current moderation beside historical artifacts for %s",
  (output) => {
    const screening = {
      verdict: "flagged" as const,
      reason: "Historical screening concern.",
      signals: [],
      checkedAt: "2026-10-28T00:00:00Z",
      provider: "claude" as const,
    };
    const history: Omit<WorkflowArtifact, "contentHash"> = {
      id: "screening-one",
      runId: "run",
      stepId: "old-screening",
      attemptId: "old-attempt",
      proposalRevision: "proposal",
      output: "screening",
      screening,
      createdAt: screening.checkedAt,
    };
    const artifact = { ...history, contentHash: workflowArtifactHash(history) };
    const input: StageInput = {
      stage: "screen",
      idea: {
        ...createSeed().ideas[0]!,
        status: "planned",
        reviewNote:
          "Use a softer lantern light.\u202e " + "details ".repeat(600),
        screening: {
          ...screening,
          verdict: "clear",
          reason: "Cleared by the streamer.",
          checkedAt: "2026-10-28T00:01:00Z",
        },
      },
      settings: { ...defaultSettings(), agentPrompt: "" },
      integration: defaultIntegration(),
      workflow: {
        runId: "run",
        definitionRevision: "definition",
        proposalRevision: "proposal",
        attemptId: "retry-attempt",
        inputArtifacts: [artifact],
        step: {
          id: `retry-${output}`,
          name: "Revise",
          kind: "ai",
          instructions: "Revise the proposal.",
          output,
          access: output === "codechange" ? "editworktree" : "none",
          provider: "claude",
          model: "test-model",
          automatic: false,
        },
      },
    };
    const prompt = record(JSON.parse(executionTaskPrompt(input)));
    expect(prompt.streamerReviewFeedback).toEqual(
      expect.stringMatching(/^Use a softer lantern light\./),
    );
    expect(String(prompt.streamerReviewFeedback).length).toBeLessThanOrEqual(
      3000,
    );
    expect(String(prompt.streamerReviewFeedback).length).toBeGreaterThan(2900);
    expect(String(prompt.streamerReviewFeedback)).not.toContain("\u202e");
    expect(prompt.currentModeration).toEqual({
      status: "planned",
      verdict: "clear",
      reason: "Cleared by the streamer.",
      checkedAt: "2026-10-28T00:01:00Z",
    });
    expect(prompt.boundArtifacts).toMatchObject([
      {
        contentHash: artifact.contentHash,
        screening: {
          verdict: "flagged",
          reason: "Historical screening concern.",
        },
      },
    ]);
    expect(artifact.screening?.verdict).toBe("flagged");
    expect(executionSystemPrompt(input)).toContain("expand permissions");
    expect(executionSystemPrompt(input)).toContain(
      "requires final human review",
    );
  },
);
