import { captureCouncilIdea } from "../../src/plugin/features/coforge/application/council-linked-idea";
import {
  CouncilCatalogue,
  type CouncilCatalogueSnapshot,
} from "../../src/plugin/features/coforge/application/council-catalogue";
import {
  councilAdmission,
  councilDispatch,
  resolveCouncilPlan,
  type CouncilPreflight,
  type CouncilSource,
  type CouncilTarget,
} from "../../src/plugin/features/coforge/application/council-execution";
import type {
  CouncilActions,
  CouncilRuntimeSnapshot,
} from "../../src/plugin/features/coforge/application/council-ports";
import { ExecutionKernel } from "../../src/plugin/features/coforge/application/execution-kernel";
import type { StudioStore } from "../../src/plugin/features/coforge/application/studio-store";
import {
  isWorkflowV2Run,
  workflowV2Admission,
  workflowV2Dispatch,
} from "../../src/plugin/features/coforge/application/workflow-v2-execution";
import {
  definitionRevision,
  type CouncilDefinitionDocument,
} from "../../src/plugin/features/coforge/domain/council-definitions";
import { type ExecutionRun } from "../../src/plugin/features/coforge/domain/execution-run";
import { contextEventId } from "../../src/plugin/features/coforge/domain/integrity";
import {
  DEFAULT_COUNCIL_FOLDERS,
  councilDefinitionFoldersCheck,
} from "../../src/plugin/features/coforge/domain/council-definition-folders";
import { createCouncilPreviewWorkflows } from "./council-preview-workflows";
import { assertReviewedCouncilIdentity } from "../../src/plugin/features/coforge/application/reviewed-preflight";
import { councilExampleDefinitions } from "./council-preview-data";
import { councilReviewJournal } from "./council-preview-recovery";
import { createCouncilPreviewTasks } from "./council-preview-tasks";
import type { WorkflowOutputTemplateActions } from '../../src/plugin/features/coforge/application/workflow-output-templates';

export const COUNCIL_EXAMPLE_SOURCE = "CoForge/Examples/Council proposal.md";
/** Created only after Explore Council example. All definitions, responses and projections stay in memory. */
export function createCouncilPreview(
  studio: StudioStore,
  reviewScenario: string | null = null,
  outputTemplates?: WorkflowOutputTemplateActions,
): CouncilActions {
  const projectId = studio.snapshot().activeProjectId || "CFP-001";
  const { agents, team, council, workflow } =
    councilExampleDefinitions(projectId);
  const definitions: CouncilCatalogueSnapshot = { valid: [], invalid: [] };
  let definitionFolders = { ...DEFAULT_COUNCIL_FOLDERS };
  const put = (definition: CouncilDefinitionDocument) => {
    const existingPath = definitions.valid.find(
      (entry) => entry.definition.id === definition.id,
    )?.path;
    const folder =
      definition.schema === "agent/v1"
        ? definitionFolders.agents
        : definition.schema === "team/v1"
          ? definitionFolders.teams
          : definitionFolders.councils;
    definitions.valid = [
      ...definitions.valid.filter(
        (entry) => entry.definition.id !== definition.id,
      ),
      {
        path: existingPath ?? `${folder}/${definition.id}.md`,
        definition: structuredClone(definition),
        revision: definitionRevision(definition),
      },
    ];
  };
  agents.forEach(put);
  put(team);
  put(council);
  const catalogue = new CouncilCatalogue({
    scan: async () => structuredClone(definitions),
    save: async (definition) => {
      put(definition);
    },
    open: async () => {
      throw new Error(
        "The browser example has no vault notes. Open the Council in Obsidian to edit its canonical notes.",
      );
    },
  });
  const source: CouncilSource = {
    sourceId: "example-source",
    generation: 0,
    revision: contextEventId("example source"),
    markdown:
      "# A lantern for the forest path\n\nPropose a readable, accessible way for players to light the route. State assumptions and tradeoffs.",
  };
  const sources = new Map<string, CouncilSource>([
    [COUNCIL_EXAMPLE_SOURCE, source],
  ]);
  const sourceDrafts = new Set<string>();
  const tasks = createCouncilPreviewTasks(
    catalogue,
    (id) =>
      Boolean(
        studio
          .snapshot()
          .projects?.some(
            (project) => project.id === id && !project.unavailable,
          ),
      ),
    (path, value) => {
      sources.set(path, value);
    },
    async (link, projectId) => {
      const state = studio.internalSnapshot();
      return captureCouncilIdea(
        state.ideas.find((item) => item.id === link.ideaId),
        state.integrity[link.ideaId],
        projectId,
        link.revision,
      ).context;
    },
  );
  function capture(path: string): CouncilSource {
    const selected = sources.get(path);
    if (!selected)
      throw new Error(
        `This example uses ${COUNCIL_EXAMPLE_SOURCE}. Desktop Obsidian can read your own private notes.`,
      );
    if (sourceDrafts.has(path))
      throw new Error(
        "The example note is Draft. Mark it Ready before previewing or submitting it.",
      );
    return structuredClone(selected);
  }
  let journal = councilReviewJournal(reviewScenario, definitions, source);
  let ready = false;
  let executor = false;
  const listeners = new Set<(value: CouncilRuntimeSnapshot) => void>();
  const preferences: CouncilRuntimeSnapshot["preferences"] = {
    format: "coforge-council-settings/v1",
    revision: 0,
    executorId: "",
    bindings: [],
  };
  const kernel = new ExecutionKernel({
    journal: {
      load: async () => structuredClone(journal),
      save: async (value) => {
        journal = structuredClone(value);
      },
    },
    now: () => new Date().toISOString(),
    id: () => crypto.randomUUID(),
    assertEligible: async (run) => {
      if (run.subject.kind === "idea" && run.subject.ideaRevision) {
        const subject = run.subject;
        const state = studio.internalSnapshot();
        captureCouncilIdea(
          state.ideas.find((item) => item.id === subject.ideaId),
          state.integrity[subject.ideaId],
          run.projectId,
          subject.ideaRevision!,
        );
      }
    },
    resolveInvocation: (run, invocation) =>
      isWorkflowV2Run(run)
        ? workflowV2Dispatch(run, invocation)
        : councilDispatch(run, invocation),
    invoke: async (run, invocation) => ({
      simulated: true,
      markdown: `**Simulated ${invocation.roundId}**\n\n${agents.find((agent) => agent.id === invocation.agentId)?.name ?? invocation.agentId}: This is deterministic fake output for the browser example. Review assumptions, preserve alternative proposals and ask the streamer to decide.\n\nIncluded ${run.artifacts.filter((artifact) => invocation.inputRoundIds.includes(artifact.roundId)).length} prior contributions.`,
    }),
    publish: async () => undefined,
  });
  const snapshot = (): CouncilRuntimeSnapshot => ({
    ready,
    paused: kernel.isPaused,
    executor,
    deviceId: "browser-example",
    preferences: structuredClone(preferences),
    runs: kernel.snapshot().runs,
    intake: [],
    error: "",
  });
  const emit = () => {
    for (const listener of listeners) listener(snapshot());
  };
  kernel.subscribe(emit);
  void kernel.load().then(() => {
    ready = true;
    emit();
  });
  async function preflight(
    target: CouncilTarget,
    path: string,
  ): Promise<CouncilPreflight> {
    const plan = resolveCouncilPlan(await catalogue.list(), target);
    const source = capture(path);
    if (source.linkedIdea) {
      const state = studio.internalSnapshot();
      captureCouncilIdea(
        state.ideas.find((item) => item.id === source.linkedIdea?.ideaId),
        state.integrity[source.linkedIdea.ideaId],
        plan.definition.projectId,
        source.linkedIdea.revision,
      );
    }
    return {
      plan,
      source,
      context:
        "Explicit browser example: no provider, filesystem or vault access.",
      invocations: plan.invocations.length,
      warnings: [
        "Simulation only. Output is fake and discarded when the page reloads.",
      ],
    };
  }
  function checkDestination(destination: string): void {
    if (
      !destination.startsWith("CoForge/Tests/") ||
      !destination.endsWith(".md")
    )
      throw new Error(
        "Choose an explicit example destination under CoForge/Tests.",
      );
  }
  async function runReady(): Promise<void> {
    for (;;) {
      const next = kernel
        .snapshot()
        .runs.find(
          (run) =>
            run.state === "queued" &&
            !run.pauseRequested &&
            !preferences.pausedProjectIds?.includes(run.projectId),
        );
      if (!next || kernel.isPaused) return;
      await kernel.step(next.id);
    }
  }
  const workflows = createCouncilPreviewWorkflows(
    catalogue,
    workflow,
    capture,
    async (preview, destination) => {
      checkDestination(destination);
      const id = crypto.randomUUID();
      return kernel.admit(
        workflowV2Admission(preview, id, `example-workflow-${id}`, true),
      );
    },
    outputTemplates,
  );
  const unsupported = async () => {
    throw new Error(
      "Watched vault inboxes and team-message delivery require desktop Obsidian. This explicit browser example keeps all work in memory.",
    );
  };
  return {
    ...tasks,
    definitionFolders: {
      preview: async (folders) => ({
        folders: councilDefinitionFoldersCheck(folders),
        definitionCount: definitions.valid.length,
        invalid: [],
      }),
      configure: async (folders, revision) => {
        if (revision !== preferences.revision)
          throw new Error(
            "Example folder settings changed. Preview again before saving.",
          );
        definitionFolders = councilDefinitionFoldersCheck(folders);
        preferences.definitionFolders = { ...definitionFolders };
        preferences.revision++;
        emit();
      },
    },
    catalogue,
    workflows,
    snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    designateExecutor: async () => {
      executor = true;
      preferences.executorId = "browser-example";
      emit();
    },
    preflight,
    setSourceState: async (path, state) => {
      if (!sources.has(path))
        throw new Error(
          "Select the explicit example source note before changing submission state.",
        );
      if (state.draft) sourceDrafts.add(path);
      else sourceDrafts.delete(path);
    },
    submit: async () => {
      throw new Error(
        "This browser example runs simulation only. Choose an explicit simulation destination.",
      );
    },
    simulate: async (
      target,
      path,
      destination,
      expectedIdentity,
    ): Promise<ExecutionRun> => {
      checkDestination(destination);
      const preview = await preflight(target, path);
      assertReviewedCouncilIdentity(preview, expectedIdentity);
      const id = crypto.randomUUID();
      return kernel.admit(
        councilAdmission(preview, id, `example-${id}`, {
          timeoutSeconds: 180,
          maxTurns: 12,
          maxBudgetUsd: 1,
          simulation: true,
        }),
      );
    },
    resume: async () => {
      kernel.resume();
      emit();
      await runReady();
    },
    pause: () => {
      kernel.pause();
      emit();
    },
    pauseRun: (id, paused) => kernel.pauseRun(id, paused),
    extendAllowance: (id, patch) => kernel.extendAllowance(id, patch),
    pauseProject: async (id, paused) => {
      preferences.pausedProjectIds = paused
        ? [...new Set([...(preferences.pausedProjectIds ?? []), id])]
        : (preferences.pausedProjectIds ?? []).filter(
            (project) => project !== id,
          );
      emit();
      if (!paused) await runReady();
    },
    retry: (id, acknowledge) => kernel.retry(id, acknowledge),
    repair: (id) => kernel.repair(id),
    cancel: (id) => kernel.cancel(id),
    skipInvocation: (id, reason, acknowledge) =>
      kernel.skipInvocation(id, reason, acknowledge),
    continueSnapshot: (id) => {
      const run = kernel.snapshot().runs.find((value) => value.id === id);
      const current = [...sources.values()].find(
        (value) => value.sourceId === run?.subject.sourceId,
      );
      return kernel.continueSnapshot(id, current?.revision ?? source.revision);
    },
    acknowledgeCheckpoint: async (runId, checkpointId, checkedIds, note) => {
      await kernel.acknowledgeCheckpoint(runId, checkpointId, checkedIds, note);
      await runReady();
    },
    saveBindings: unsupported,
    previewInbox: async () => [],
    activateInbox: unsupported,
    resetInbox: unsupported,
    runAgain: unsupported,
    messages: () => [],
    postInformation: unsupported,
    flushMessages: unsupported,
    stopConversation: unsupported,
    exportRun: async (id) => kernel.exportRun(id),
    pruneRun: (id) => kernel.pruneRun(id),
    reassignProjection: unsupported,
    handoffPlan: unsupported,
  };
}
