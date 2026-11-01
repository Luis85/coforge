import { expect, it } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import type {
  StageInput,
  StageResult,
  StageRunner,
} from "../../../features/coforge/application/ports";
import { MemoryStorage, nodeTimers } from "./memory-storage";
import { objectDefinition } from "./request-object-fixture";
import { requestObjectRevision } from "../../../features/coforge/domain/request-object";
import { ideaFingerprint } from "../../../features/coforge/domain/integrity";
import { workflowProposalRevision } from "../../../features/coforge/domain/configured-workflow-run";
import { stageInput } from "../../../features/coforge/application/agent-prompts";
import { executionTaskPrompt } from "../../../features/coforge/application/workflow-execution";
import { record } from "../../../features/coforge/domain/check";
import { buildPublicBoard } from "../../../features/coforge/domain/public-board";

async function fixture(custom?: StageRunner) {
  const timers = nodeTimers();
  const runner = custom ?? createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.start();
  const project = await studio.createProject({
    projectName: "Business studio",
    projectBrief: "Private proposal fields and explicit review.",
    projectPath: "/synthetic/business",
    requestObject: objectDefinition(),
  });
  return { studio, project };
}
const input = {
  title: "A useful onboarding flow",
  description: "Make onboarding easier to understand.",
  category: "Gameplay",
  username: "Owner",
};

it("routes manual and chat requests to their parent schema with defaults and no required chat fields", async () => {
  const { studio, project } = await fixture();
  try {
    await studio.createProject({
      projectName: "Other studio",
      projectBrief: "A different project with independent request fields.",
      projectPath: "/synthetic/other",
      requestObject: {
        format: "coforge-request-object/v1",
        className: "Feature Idea",
        fields: [],
      },
    });
    await studio.createIdea({
      ...input,
      projectId: project.id,
      requestValues: { customer: "PRIVATE_CUSTOMER" },
      requestObjectRevision: requestObjectRevision(
        project.settings.requestObject,
      ),
    });
    expect(studio.state().ideas[0]).toMatchObject({
      projectId: project.id,
      requestObject: {
        className: "Business Idea",
        values: {
          customer: "PRIVATE_CUSTOMER",
          "business-value": 0,
          validated: false,
          priority: "Low",
        },
      },
    });
    const viewer = {
      username: "Viewer",
      userId: "viewer-one",
      source: "twitch" as const,
    };
    await studio.ingest({
      ...viewer,
      text: "!register",
      messageId: "registration",
    });
    const feature = await studio.ingest({
      ...viewer,
      text: `!request ${project.id} Give the library a useful search`,
      messageId: "feature",
    });
    expect(feature.ok).toBe(true);
    expect(
      studio.state().ideas.find((idea) => idea.id === feature.ideaId)
        ?.requestObject,
    ).toMatchObject({
      className: "Business Idea",
      values: { "business-value": 0, validated: false, priority: "Low" },
    });
    const bug = await studio.ingest({
      ...viewer,
      text: `!bug ${project.id} Fix the missing search icon`,
      messageId: "bug",
    });
    expect(
      studio.state().ideas.find((idea) => idea.id === bug.ideaId),
    ).toMatchObject({
      projectId: project.id,
      requestKind: "bug",
      requestObject: { className: "Business Idea" },
    });
    const count = studio.state().ideas.length;
    await studio.updateProject(
      {
        requestObject: {
          ...objectDefinition(),
          className: "New classification",
        },
      },
      project.id,
    );
    await expect(
      studio.createIdea({
        ...input,
        projectId: project.id,
        requestObjectRevision: requestObjectRevision(
          project.settings.requestObject,
        ),
      }),
    ).rejects.toThrow(/fields changed/iu);
    expect(studio.state().ideas).toHaveLength(count);
  } finally {
    await studio.stop();
  }
});

it("includes captured fields in untrusted legacy/configured dispatch and preserves the public whitelist", async () => {
  const { studio } = await fixture();
  try {
    await studio.createIdea({
      ...input,
      requestValues: { customer: "PRIVATE_CUSTOMER" },
    });
    const idea = studio.state().ideas[0]!;
    const legacy = record(
      JSON.parse(stageInput("screen", idea, studio.state().settings)),
    );
    expect(record(legacy.untrustedCommunityProposal).requestObject).toEqual(
      idea.requestObject,
    );
    const configured: StageInput = {
      stage: "screen",
      idea,
      settings: studio.state().settings,
      integration: studio.integration(),
      workflow: {
        runId: "run",
        definitionRevision: "definition",
        proposalRevision: workflowProposalRevision(idea),
        attemptId: "attempt",
        inputArtifacts: [],
        step: {
          id: "screen",
          name: "Screen",
          kind: "ai",
          instructions: "Inspect the complete proposal.",
          output: "screening",
          access: "none",
          provider: "demo",
          model: "sonnet",
          automatic: false,
        },
      },
    };
    expect(
      record(
        record(JSON.parse(executionTaskPrompt(configured)))
          .untrustedCommunityProposal,
      ).requestObject,
    ).toEqual(idea.requestObject);
    await studio.store.transaction((state) => {
      const source = state.ideas[0]!;
      source.status = "screened";
      source.screening = {
        verdict: "clear",
        reason: "Reviewed",
        signals: [],
        checkedAt: new Date().toISOString(),
        provider: "demo",
      };
    });
    const board = buildPublicBoard(studio.state(), new Date());
    expect(
      board.columns
        .flatMap((column) => column.ideas)
        .some((value) => value.id === idea.id),
    ).toBe(true);
    expect(JSON.stringify(board)).not.toContain("PRIVATE_CUSTOMER");
    expect(JSON.stringify(board)).not.toContain("Business Idea");
  } finally {
    await studio.stop();
  }
});

it("invalidates both proposal revisions and in-flight screening when captured values change", async () => {
  let started!: () => void;
  let finish!: (value: StageResult) => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<StageResult>((resolve) => {
    finish = resolve;
  });
  const { studio, project } = await fixture(async () => {
    started();
    return pending;
  });
  try {
    await studio.ingest({ username: 'Viewer', text: '!register' });
    await studio.ingest({ username: 'Viewer', text: `!request ${project.id} A useful onboarding flow` });
    const before = studio.state().ideas[0]!;
    const fingerprint = ideaFingerprint(before);
    const revision = workflowProposalRevision(before);
    await studio.engine.submit(before.id, "screen");
    await began;
    await studio.updateRequestValues(
      before.id,
      { customer: "A changed customer" },
      ideaFingerprint(studio.state().ideas[0]!),
    );
    const changed = studio.state().ideas[0]!;
    expect(ideaFingerprint(changed)).not.toBe(fingerprint);
    expect(workflowProposalRevision(changed)).not.toBe(revision);
    finish({
      screening: {
        verdict: "clear",
        reason: "Old field values",
        signals: [],
        checkedAt: new Date().toISOString(),
        provider: "demo",
      },
    });
    await studio.engine.waitUntilIdle();
    expect(studio.state().ideas[0]).toMatchObject({
      status: "inbox",
      requestObject: { values: { customer: "A changed customer" } },
    });
    expect(studio.state().ideas[0]?.screening).toBeUndefined();
    expect(studio.state().jobs.at(-1)?.status).toBe("failed");
  } finally {
    finish({});
    await studio.stop();
  }
});
