import { councilKernelHost } from "./council-kernel-host";
import { startCouncilRuntimeLoop } from "./council-runtime-loop";
import { CouncilRunContext } from "./council-run-context";
import { CouncilAdmissions } from "./council-admissions";
import { createCouncilActions } from "./council-actions";
import type { Plugin, TFile } from "obsidian";
import { hostname } from "os";
import { CouncilCatalogue } from "../../features/coforge/application/council-catalogue";
import type {
  CouncilActions,
  CouncilPreferences,
  CouncilRuntimeSnapshot,
} from "../../features/coforge/application/council-ports";
import { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import { ExecutionScheduler } from "../../features/coforge/application/execution-scheduler";
import { CouncilIntakeRuntime } from "./council-intake-runtime";
import type { InvocationGate } from "../../features/coforge/application/invocation-gate";
import type { StudioService } from "../../features/coforge/application/studio";
import type { Timers } from "../../features/coforge/application/ports";
import type { ExecutionRun } from "../../features/coforge/domain/execution-run";
import { contextEventId } from "../../features/coforge/domain/integrity";

import { FileExecutionJournal } from "./execution-journal-storage";
import { CouncilStateStorage } from "./council-state-storage";
import {
  CouncilSourceNotes,
  indexCouncilRunSources,
} from "./council-source-notes";

import {
  DEFAULT_COUNCIL_FOLDERS,
  VaultCouncilDefinitions,
} from "./vault-council-definitions";
import {
  protectCouncilPrivatePaths,
  councilRegisteredPrivateFolders,
} from "./council-private-data";
import { CouncilInvocationHost } from "./council-invocation-host";
import { CouncilMessagingModule } from "./council-messaging-module";
import { CouncilWorkflowModule } from "./council-workflow-module";
import { executionCostTasks } from "../../features/coforge/application/execution-costs";
import type { IntakeFolderPolicy } from "../../features/coforge/domain/intake-bindings";
import { CouncilWorkflowMessaging } from "./council-workflow-messaging";
import { councilDefinitionConfiguration } from "./council-definition-configuration";
import { readCouncilDefinitionUsage } from "../../features/coforge/application/council-definition-usage";

/** Host composition for typed note execution. Providers and v1 workflows share the injected slot. */
export class CouncilModule {
  readonly actions: CouncilActions;
  private readonly storage: CouncilStateStorage;
  private readonly journal: FileExecutionJournal;
  private readonly kernel: ExecutionKernel;
  private readonly sources: CouncilSourceNotes;
  private readonly intakeRuntime: CouncilIntakeRuntime;
  private readonly scheduler: ExecutionScheduler;
  private readonly messaging: CouncilMessagingModule;
  private readonly workflows: CouncilWorkflowModule;
  private readonly workflowMessaging: CouncilWorkflowMessaging;
  private readonly context: CouncilRunContext;
  private readonly admissions: CouncilAdmissions;
  private readonly definitionLocations: () => readonly string[];
  private readonly listeners = new Set<
    (snapshot: CouncilRuntimeSnapshot) => void
  >();
  private readonly invocationHost: CouncilInvocationHost;
  private readonly deviceId = contextEventId(hostname());
  private preferences: CouncilPreferences = {
    format: "coforge-council-settings/v1",
    revision: 0,
    executorId: "",
    bindings: [],
  };
  private secondaryRuns: ExecutionRun[] = [];
  private ready = false;
  private disposed = false;
  private error = "";
  private stopLoop?: () => void;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly plugin: Plugin,
    private readonly studio: StudioService,
    private readonly timers: Timers,
    gate: InvocationGate,
    projectFile?: (id: string) => TFile | null,
  ) {
    this.storage = new CouncilStateStorage(plugin);
    this.journal = new FileExecutionJournal(
      plugin.app.vault.adapter,
      this.storage.directory,
    );
    const definitions = new VaultCouncilDefinitions(
      plugin,
      () => this.preferences.definitionFolders ?? DEFAULT_COUNCIL_FOLDERS,
      (paths) => this.protect(paths),
      () => studio.integration().publicFolder,
    );
    const catalogue = new CouncilCatalogue(definitions, (id) =>
      readCouncilDefinitionUsage(
        studio.state().projects ?? [],
        this.workflows.actions,
        this.preferences.bindings,
        id,
      ),
    );
    this.definitionLocations = () => definitions.privateFolders();
    const definitionFolders = councilDefinitionConfiguration(definitions, {
      preferences: () => this.preferences,
      folderPolicy: () => this.folderPolicy(),
      assertExecutor: () => this.assertExecutor(),
      protect: (paths) => this.protect(paths),
      save: (value) => this.savePreferences(value),
      publish: () => this.publish(),
    });
    this.sources = new CouncilSourceNotes(
      plugin.app.vault,
      () => this.runs(),
      () => this.kernel.snapshot().projections ?? [],
      (path) => {
        this.context.sourcePath(path);
      },
    );
    this.kernel = new ExecutionKernel(
      councilKernelHost(this.journal, {
        context: () => this.context,
        invocations: () => this.invocationHost,
        workflowMessages: () => this.workflowMessaging,
        messages: () => this.messaging,
        sources: this.sources,
        assertExecutor: () => this.assertExecutor(),
      }),
    );
    this.messaging = new CouncilMessagingModule(
      plugin,
      this.kernel,
      catalogue,
      (paths) => this.protect(paths),
      (target, path, key) => this.admissions.submit(target, path, false, key),
      {
        resolve: (id, teamId) => this.workflows.messageRecipient(id, teamId),
        dispatch: async (id, path, key) => {
          await this.assertExecutor();
          await this.workflows.start(id, path, false, undefined, key);
        },
      },
    );
    this.workflowMessaging = new CouncilWorkflowMessaging(
      this.kernel,
      catalogue,
    );
    this.invocationHost = new CouncilInvocationHost(
      studio,
      gate,
      () => this.kernel,
      () => this.messaging,
      (run, invocation) => this.context.eligible(run, invocation),
      timers,
    );
    this.workflows = new CouncilWorkflowModule(
      plugin,
      studio,
      this.kernel,
      this.sources,
      catalogue,
      (paths) => this.protect(paths),
      () => this.assertExecutor(),
      {
        projectFile,
        definitionFolders: () => this.definitionLocations(),
        messages: (team, project, recent, limit) =>
          this.messaging.context(team, project, recent, limit),
      },
    );
    this.kernel.subscribe(() => this.publish());
    this.intakeRuntime = new CouncilIntakeRuntime(
      plugin.app.vault,
      this.sources,
      this.storage,
      timers,
      {
        enabled: () => this.executor && !this.disposed,
        preferences: () => this.preferences,
        assertExecutor: () => this.assertExecutor(),
        admit: (input) => this.admissions.admit(input),
        definitionChanged: (event) =>
          definitions.invalidate(
            event.path,
            event.oldPath,
            event.folder,
            event.metadataOnly,
          ),
        publish: () => this.publish(),
        error: (message) => {
          this.error = message;
          this.publish();
        },
      },
      plugin.app.metadataCache,
    );
    this.scheduler = new ExecutionScheduler(this.kernel, {
      projectEnabled: (id) =>
        this.executor &&
        !this.projectPaused(id) &&
        this.context.projectReady(id),
      providerAvailable: () => true,
      blocked: () => {
        this.error =
          "A run needs attention. Inspect its source, definitions, provider and publication state.";
        this.publish();
      },
    });
    this.context = new CouncilRunContext(
      plugin,
      studio,
      this.sources,
      catalogue,
      this.messaging,
      () => this.assertReady(),
      () => this.assertExecutor(),
      (id) => this.projectPaused(id),
      () => this.definitionLocations(),
    );
    this.admissions = new CouncilAdmissions(
      plugin,
      studio,
      this.kernel,
      this.sources,
      catalogue,
      this.context,
      this.workflows,
      this.messaging,
      (paths) => this.protect(paths),
      () => this.assertExecutor(),
    );
    this.actions = createCouncilActions({
      catalogue,
      definitionFolders: {
        preview: definitionFolders.preview,
        configure: (folders, revision) =>
          this.serial(() => definitionFolders.configure(folders, revision)),
      },
      workflows: this.workflows,
      messaging: this.messaging,
      kernel: this.kernel,
      intake: this.intakeRuntime.intake,
      watcher: this.intakeRuntime.watcher,
      admissions: this.admissions,
      context: this.context,
      sources: this.sources,
      deviceId: this.deviceId,
      preferences: () => this.preferences,
      folderPolicy: () => this.folderPolicy(),
      snapshot: () => this.snapshot(),
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      },
      assertReady: () => this.assertReady(),
      assertExecutor: () => this.assertExecutor(),
      publish: () => this.publish(),
      clearError: () => {
        this.error = "";
      },
      protect: (paths) => this.protect(paths),
      savePreferences: (value) => this.savePreferences(value),
      startWatcher: () =>
        this.intakeRuntime.watcher.configure(this.preferences.bindings),
      loadExecutor: async () => {
        await this.kernel.load();
        this.secondaryRuns = [];
      },
      serial: (work) => this.serial(work),
    });
  }
  private get executor(): boolean {
    return this.preferences.executorId === this.deviceId;
  }
  costTasks() {
    return executionCostTasks(this.runs(), this.studio.state().projects ?? []);
  }
  privateFolders(): readonly string[] {
    return councilRegisteredPrivateFolders(
      this.studio.ready
        ? this.definitionLocations()
        : Object.values(
            this.preferences.definitionFolders ?? DEFAULT_COUNCIL_FOLDERS,
          ),
      this.preferences.bindings,
      this.sources.privateFolders(),
    );
  }
  private runs(): ExecutionRun[] {
    return this.executor
      ? this.kernel.snapshot().runs
      : structuredClone(this.secondaryRuns);
  }
  private assertReady(): void {
    if (!this.ready || this.disposed)
      throw new Error(
        "Council runtime is not ready. Reload after repairing its private storage.",
      );
  }
  private async assertExecutor(): Promise<void> {
    this.assertReady();
    const current = await this.storage.preferences();
    if (this.executor && current.executorId !== this.deviceId)
      this.secondaryRuns = this.kernel.snapshot().runs;
    this.preferences = current;
    if (current.executorId !== this.deviceId)
      throw new Error(
        "Designate this desktop as the execution device before changing intake or dispatching work.",
      );
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private snapshot(): CouncilRuntimeSnapshot {
    return {
      ready: this.ready,
      paused: this.kernel.isPaused,
      executor: this.executor,
      deviceId: this.deviceId,
      preferences: structuredClone(this.preferences),
      runs: this.runs(),
      intake: this.intakeRuntime.results(),
      error: this.error,
    };
  }
  private publish(): void {
    if (!this.disposed)
      for (const listener of this.listeners) {
        try {
          listener(this.snapshot());
        } catch {
          /* View failure does not change execution. */
        }
      }
  }
  private async protect(paths: string[]): Promise<void> {
    await protectCouncilPrivatePaths(
      this.plugin,
      paths,
      this.studio.integration().publicFolder,
    );
  }
  private async savePreferences(value: CouncilPreferences): Promise<void> {
    const next = { ...value, revision: this.preferences.revision + 1 };
    await this.protect([]);
    await this.storage.savePreferences(next, this.preferences.revision);
    this.preferences = next;
  }
  private projectPaused(id: string): boolean {
    return (this.preferences.pausedProjectIds ?? []).includes(id);
  }
  private folderPolicy(): IntakeFolderPolicy {
    return {
      publicFolder: this.studio.integration().publicFolder,
      configFolder: this.plugin.app.vault.configDir,
      definitionFolders: [...this.definitionLocations()],
      outputFolders: ["CoForge/Tests", "CoForge/Messages"],
    };
  }
  async start(): Promise<void> {
    try {
      this.preferences = await this.storage.preferences();
      this.ready = true;
      if (this.executor) await this.kernel.load();
      else this.secondaryRuns = (await this.journal.load()).runs;
      await indexCouncilRunSources(this.plugin, this.sources, this.runs());
      await this.intakeRuntime.watcher.configure(this.preferences.bindings);
      this.stopLoop = startCouncilRuntimeLoop(
        this.timers,
        this.scheduler,
        this.messaging.service,
        this.intakeRuntime.watcher,
        () => !this.disposed && this.executor,
        () => {
          this.error =
            "Message delivery or inbox reconciliation needs repair. Committed results remain retained.";
          this.publish();
        },
      );

      this.publish();
    } catch {
      this.ready = false;
      this.error =
        "The private Council records could not be loaded. Preserve their files, repair storage, then reload.";
      this.publish();
    }
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    this.stopLoop?.();
    this.intakeRuntime.watcher.dispose();
    this.scheduler.dispose();
    this.invocationHost.dispose();
    await this.kernel.flushTiming();
    await this.tail;
    this.listeners.clear();
  }
}
