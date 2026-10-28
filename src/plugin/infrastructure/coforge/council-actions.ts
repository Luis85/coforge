import type {
  CouncilActions,
  CouncilPreferences,
  CouncilRuntimeSnapshot,
} from "../../features/coforge/application/council-ports";
import type {
  CouncilCatalogueActions,
  CouncilFolderActions,
} from "../../features/coforge/application/council-catalogue";
import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import type { IntakeService } from "../../features/coforge/application/intake-service";
import {
  validateIntakeBindings,
  type IntakeBinding,
  type IntakeFolderPolicy,
} from "../../features/coforge/domain/intake-bindings";
import type { CouncilWorkflowModule } from "./council-workflow-module";
import type { CouncilMessagingModule } from "./council-messaging-module";
import type { CouncilAdmissions } from "./council-admissions";
import type { CouncilRunContext } from "./council-run-context";
import type { CouncilSourceNotes } from "./council-source-notes";
import type { CouncilInboxWatcher } from "./council-inbox-watcher";

export interface CouncilActionHost {
  catalogue: CouncilCatalogueActions;
  definitionFolders: CouncilFolderActions;
  workflows: CouncilWorkflowModule;
  messaging: CouncilMessagingModule;
  kernel: ExecutionKernel;
  intake: IntakeService;
  watcher: CouncilInboxWatcher;
  admissions: CouncilAdmissions;
  context: CouncilRunContext;
  sources: CouncilSourceNotes;
  deviceId: string;
  preferences(): CouncilPreferences;
  folderPolicy(): IntakeFolderPolicy;
  snapshot(): CouncilRuntimeSnapshot;
  subscribe(listener: (snapshot: CouncilRuntimeSnapshot) => void): () => void;
  assertReady(): void;
  assertExecutor(): Promise<void>;
  publish(): void;
  clearError(): void;
  protect(paths: string[]): Promise<void>;
  savePreferences(value: CouncilPreferences): Promise<void>;
  startWatcher(): Promise<void>;
  loadExecutor(): Promise<void>;
  serial<T>(work: () => Promise<T>): Promise<T>;
}
/** Public commands stay small; effects and policy remain in their injected services. */
export function createCouncilActions(host: CouncilActionHost): CouncilActions {
  const binding = (id: string): IntakeBinding => {
    const value = host.preferences().bindings.find((item) => item.id === id);
    if (!value) throw new Error("Inbox binding not found.");
    return value;
  };
  return {
    assertExecutor: () => host.assertExecutor(),
    catalogue: host.catalogue,
    definitionFolders: host.definitionFolders,
    workflows: host.workflows.actions,
    snapshot: host.snapshot,
    subscribe: host.subscribe,
    designateExecutor: () =>
      host.serial(async () => {
        host.assertReady();
        await host.savePreferences({
          ...host.preferences(),
          executorId: host.deviceId,
        });
        await host.loadExecutor();
        await host.startWatcher();
        host.publish();
      }),
    saveBindings: (values, revision) =>
      host.serial(async () => {
        await host.assertExecutor();
        if (revision !== host.preferences().revision)
          throw new Error("Inbox settings changed. Refresh before saving.");
        const checked = validateIntakeBindings(values, host.folderPolicy());
        for (const value of checked) {
          const previous = host
            .preferences()
            .bindings.find((item) => item.id === value.id);
          const targetChanged =
            !previous ||
            !previous.enabled ||
            previous.projectId !== value.projectId ||
            previous.teamId !== value.teamId ||
            previous.target.kind !== value.target.kind ||
            previous.target.id !== value.target.id;
          if (value.enabled && targetChanged)
            await host.admissions.validateTarget(value);
        }
        await host.protect(checked.map((item) => item.path));
        await host.savePreferences({
          ...host.preferences(),
          bindings: checked,
        });
        await host.watcher.updateBindings(checked);
        host.publish();
      }),
    previewInbox: (id) => host.watcher.preview(binding(id)),
    resetInbox: (id, revision) =>
      host.serial(async () => {
        await host.assertExecutor();
        if (revision !== host.preferences().revision)
          throw new Error(
            "Inbox settings changed. Review the reset target again.",
          );
        binding(id);
        await host.savePreferences({
          ...host.preferences(),
          bindings: host
            .preferences()
            .bindings.map((item) =>
              item.id === id ? { ...item, enabled: false } : item,
            ),
        });
        host.publish();
        await host.watcher.updateBindings(host.preferences().bindings);
        await host.intake.reset(id);
        host.publish();
      }),
    activateInbox: (id, selected) =>
      host.serial(async () => {
        await host.assertExecutor();
        const selectedBinding = binding(id);
        await host.intake.activate(
          selectedBinding,
          await host.watcher.preview(selectedBinding),
          selected,
          Date.now(),
        );
        await host.watcher.updateBindings(host.preferences().bindings);
        host.publish();
      }),
    preflight: (target, path) => host.context.preflight(target, path),
    submit: (target, path, expectedIdentity) =>
      host.serial(() =>
        host.admissions.submit(
          target,
          path,
          false,
          undefined,
          expectedIdentity,
        ),
      ),
    simulate: (target, path, destination, expectedIdentity) =>
      host.serial(() =>
        host.admissions.simulate(target, path, destination, expectedIdentity),
      ),
    runAgain: (id) => host.serial(() => host.admissions.runAgain(id)),
    setSourceState: (path, state) =>
      host.serial(async () => {
        await host.assertExecutor();
        const normalized = host.context.sourcePath(path);
        const folder = normalized.split("/").slice(0, -1).join("/");
        if (!folder) throw new Error("Choose a note inside a private folder.");
        await host.protect([folder]);
        await host.sources.setState(normalized, state);
        host.publish();
      }),
    resume: async () => {
      await host.assertExecutor();
      host.clearError();
      host.kernel.resume();
      host.publish();
    },
    pause: () => {
      host.kernel.pause();
      host.publish();
    },
    pauseProject: (id, paused) =>
      host.serial(async () => {
        await host.assertExecutor();
        if (!host.context.projectReady(id))
          throw new Error("The selected project is unavailable.");
        const ids = new Set(host.preferences().pausedProjectIds ?? []);
        if (paused) ids.add(id);
        else ids.delete(id);
        await host.savePreferences({
          ...host.preferences(),
          pausedProjectIds: [...ids],
        });
        host.publish();
      }),
    pauseRun: async (id, paused) => {
      await host.assertExecutor();
      return host.kernel.pauseRun(id, paused);
    },
    extendAllowance: (id, extension) =>
      host.serial(async () => {
        await host.assertExecutor();
        await host.kernel.extendAllowance(id, extension);
        host.clearError();
        host.publish();
      }),
    retry: async (id, ack) => {
      await host.assertExecutor();
      await host.kernel.retry(id, ack);
      host.clearError();
      host.publish();
    },
    repair: async (id) => {
      await host.assertExecutor();
      await host.kernel.repair(id);
      await host.watcher.reconcileAll();
      host.clearError();
      host.publish();
    },
    cancel: async (id) => {
      await host.assertExecutor();
      await host.kernel.cancel(id);
      await host.watcher.reconcileAll();
    },
    messages: () => host.messaging.service.messages(),
    postInformation: async (team, body) => {
      await host.assertExecutor();
      return host.messaging.postInformation(team, body);
    },
    flushMessages: async () => {
      await host.assertExecutor();
      await host.messaging.service.flush();
      host.clearError();
      host.publish();
    },
    stopConversation: async (root) => {
      await host.assertExecutor();
      await host.messaging.stop(root);
      await host.watcher.reconcileAll();
    },
    acknowledgeCheckpoint: async (id, checkpoint, checked, note) => {
      await host.assertExecutor();
      await host.kernel.acknowledgeCheckpoint(id, checkpoint, checked, note);
      await host.watcher.reconcileAll();
    },
    skipInvocation: async (id, reason, acknowledgeUnknown) => {
      await host.assertExecutor();
      return host.kernel.skipInvocation(id, reason, acknowledgeUnknown);
    },
    continueSnapshot: async (id) => {
      await host.assertExecutor();
      const run = host.kernel.snapshot().runs.find((item) => item.id === id);
      if (!run) throw new Error("The run is unavailable.");
      const note = await host.sources.read(
        host.sources.resolve(
          run.projectionTarget?.sourceId ?? run.subject.sourceId,
        ),
      );
      await host.kernel.continueSnapshot(id, note.sourceRevision);
      host.clearError();
      host.publish();
    },
    exportRun: async (id) => {
      host.assertReady();
      const run = host.snapshot().runs.find((item) => item.id === id);
      if (!run) throw new Error("The run is unavailable.");
      return JSON.stringify(
        {
          format: "coforge-execution-export/v2",
          exportedAt: new Date().toISOString(),
          run,
        },
        null,
        2,
      );
    },
    handoffPlan: (runId, artifactId, ideaId, expectedProposalRevision) =>
      host.serial(async () => {
        await host.assertExecutor();
        const run = host.kernel
          .snapshot()
          .runs.find((item) => item.id === runId);
        if (
          run &&
          (host.preferences().pausedProjectIds ?? []).includes(run.projectId)
        )
          throw new Error("Resume this project before handing off a plan.");
        await host.admissions.handoffPlan(
          runId,
          artifactId,
          ideaId,
          expectedProposalRevision,
        );
      }),
    pruneRun: (id) =>
      host.serial(async () => {
        await host.assertExecutor();
        await host.kernel.pruneRun(id);
        await host.watcher.reconcileAll();
      }),
    reassignProjection: (id, path) =>
      host.serial(async () => {
        await host.assertExecutor();
        const normalized = host.context.sourcePath(path);
        const folder = normalized.split("/").slice(0, -1).join("/");
        if (!folder)
          throw new Error("Choose an existing note in a private folder.");
        await host.protect([folder]);
        const target = await host.sources.identify(
          await host.sources.read(normalized),
        );
        await host.kernel.reassignProjection(id, target.sourceId);
      }),
  };
}
