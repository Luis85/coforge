import type { Vault, MetadataCache } from "obsidian";
import {
  IntakeService,
  type IntakeAdmission,
  type IntakeResult,
} from "../../features/coforge/application/intake-service";
import type { CouncilPreferences } from "../../features/coforge/application/council-ports";
import type { Timers } from "../../features/coforge/application/ports";
import { routeIntake, validateIntakeBindings, type IntakeBinding, type IntakeCandidate, type IntakeFolderPolicy } from "../../features/coforge/domain/intake-bindings";
import {
  CouncilInboxWatcher,
  type CouncilVaultChange,
} from "./council-inbox-watcher";
import type { CouncilSourceNotes } from "./council-source-notes";
import type { CouncilStateStorage } from "./council-state-storage";

interface CouncilIntakeHost {
  enabled(): boolean;
  preferences(): CouncilPreferences;
  folderPolicy(): IntakeFolderPolicy;
  assertExecutor(): Promise<void>;
  admit(input: IntakeAdmission): Promise<"admitted" | "duplicate" | "deferred">;
  publish(): void;
  error(message: string): void;
  definitionChanged?(event: CouncilVaultChange): void;
}
/** Observation and admission share one index while durable execution stays in the journal. */
export class CouncilIntakeRuntime {
  readonly intake: IntakeService;
  readonly watcher: CouncilInboxWatcher;
  private latest: IntakeResult[] = [];
  constructor(
    vault: Vault,
    sources: CouncilSourceNotes,
    storage: Pick<CouncilStateStorage, "intake" | "saveIntake">,
    timers: Timers,
    host: CouncilIntakeHost,
    metadataCache?: Pick<MetadataCache, "on" | "offref">,
  ) {
    const attention = "Inbox settings changed or overlap a managed output, definition, public or configuration folder. Repair the inbox scope and refresh; the source was preserved.";
    const checkedBinding = (id: string, expected?: IntakeBinding): IntakeBinding => {
      try {
        const bindings = validateIntakeBindings(host.preferences().bindings, host.folderPolicy());
        const binding = bindings.find(item => item.id === id);
        if (!binding || expected && JSON.stringify(binding) !== JSON.stringify(expected)) throw new Error(attention);
        return binding;
      } catch { host.error(attention); throw new Error(attention); }
    };
    const recordResults = (notes: readonly IntakeCandidate[], results: IntakeResult[]) => {
      this.latest = [...this.latest.filter(item => !notes.some(note => note.path === item.path)), ...results];
      host.publish();
    };
    this.intake = new IntakeService({
      load: () => storage.intake(),
      save: async (state) => {
        await host.assertExecutor();
        await storage.saveIntake(state);
      },
      identify: async (candidate) => {
        await host.assertExecutor();
        const binding = routeIntake(host.preferences().bindings.map(item => ({ ...item, enabled: true })), candidate.path);
        if (!binding) throw new Error(attention);
        checkedBinding(binding.id);
        return sources.identify(candidate);
      },
      admit: async (input) => {
        await host.assertExecutor();
        const binding = checkedBinding(input.bindingId);
        if (
          !binding ||
          !routeIntake([binding], input.path) ||
          binding.projectId !== input.projectId ||
          binding.teamId !== input.teamId ||
          binding.target.kind !== input.target.kind ||
          binding.target.id !== input.target.id
        )
          return "deferred";
        return host.admit(input);
      },
    });
    this.watcher = new CouncilInboxWatcher(
      vault,
      sources,
      {
        changed: (event) => host.definitionChanged?.(event),
        candidates: async (binding, notes, now) => {
          if (!host.enabled()) return;
          try {
            await host.assertExecutor();
            checkedBinding(binding.id, binding);
          } catch {
            recordResults(notes, notes.map(note => ({ path: note.path, ...(note.sourceId ? { sourceId: note.sourceId } : {}), status: "attention", reason: attention })));
            return;
          }
          const results = await this.intake.reconcile(binding, notes, now);
          recordResults(notes, results);
        },
        error: () =>
          host.error(
            "Inbox reconciliation needs attention. Inspect note metadata, routing and vault storage.",
          ),
      },
      timers,
      Date.now,
      metadataCache,
    );
  }
  results(): IntakeResult[] {
    return structuredClone(this.latest);
  }
}
