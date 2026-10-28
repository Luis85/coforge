import {
  intakeSubmissionKey,
  routeIntake,
  type IntakeBinding,
  type IntakeCandidate,
  type IntakeTarget,
} from "../domain/intake-bindings";

export interface IntakeActivation {
  bindingId: string;
  activatedAt: number;
  baselineSourceIds: string[];
  baselineSubmissions?: Array<{ sourceId: string; generation: number }>;
}
export interface IntakeObservation {
  key: string;
  sourceId: string;
  generation: number;
  bindingId: string;
  revision: string;
  stableSince: number;
  admitted: boolean;
}
export interface IntakeState {
  activations: IntakeActivation[];
  observations: IntakeObservation[];
}
export interface IntakeAdmission {
  key: string;
  bindingId: string;
  sourceId: string;
  generation: number;
  path: string;
  content: string;
  sourceRevision: string;
  projectId: string;
  teamId: string;
  target: IntakeTarget;
}
export interface IntakePorts {
  load(): Promise<IntakeState>;
  save(state: IntakeState): Promise<void>;
  /** Assigns minimal namespaced identity atomically while preserving human note bytes. */
  identify(
    candidate: IntakeCandidate,
  ): Promise<IntakeCandidate & { sourceId: string }>;
  /** Atomically deduplicates against durable submission tombstones; deferred writes no tombstone. */
  admit(input: IntakeAdmission): Promise<"admitted" | "duplicate" | "deferred">;
}
export type IntakeStatus =
  | "disabled"
  | "inactive"
  | "empty"
  | "draft"
  | "not-ready"
  | "settling"
  | "baseline"
  | "deferred"
  | "admitted"
  | "attention";
export interface IntakeResult {
  path: string;
  sourceId?: string;
  status: IntakeStatus;
  reason?: string;
}

/** Candidate reconciliation only. Execution remains paused/owned by the shared scheduler. */
export class IntakeService {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly ports: IntakePorts,
    private readonly maxInputCharacters = 64000,
    private readonly maxObservations = 10000,
  ) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  reset(bindingId: string): Promise<void> {
    return this.serial(async () => {
      const state = await this.ports.load();
      state.activations = state.activations.filter(
        (item) => item.bindingId !== bindingId,
      );
      state.observations = state.observations.filter(
        (item) => item.bindingId !== bindingId,
      );
      await this.ports.save(state);
    });
  }
  activate(
    binding: IntakeBinding,
    candidates: readonly IntakeCandidate[],
    includeSourceIds: readonly string[],
    now: number,
  ): Promise<void> {
    return this.serial(async () => {
      const state = await this.ports.load();
      if (state.activations.some((item) => item.bindingId === binding.id))
        throw new Error(
          "This inbox already has a baseline. Use Run again for an existing submission.",
        );
      const identified: Array<IntakeCandidate & { sourceId: string }> = [];
      for (const candidate of candidates)
        if (routeIntake([{ ...binding, enabled: true }], candidate.path))
          identified.push(await this.ports.identify(candidate));
      const ids = identified.map((item) => item.sourceId);
      if (new Set(ids).size !== ids.length)
        throw new Error(
          "Duplicate source identities block activation. Resolve the copied note identities.",
        );
      if (
        includeSourceIds.some(
          (id) =>
            !identified.some(
              (item) => item.sourceId === id || item.path === id,
            ),
        )
      )
        throw new Error(
          "The selected backlog changed. Preview existing notes again.",
        );
      const selected = new Set(
        identified
          .filter(
            (item) =>
              includeSourceIds.includes(item.sourceId) ||
              includeSourceIds.includes(item.path),
          )
          .map((item) => item.sourceId),
      );
      state.activations.push({
        bindingId: binding.id,
        activatedAt: now,
        baselineSourceIds: ids.filter((id) => !selected.has(id)),
        baselineSubmissions: identified
          .filter((item) => !selected.has(item.sourceId))
          .map((item) => ({
            sourceId: item.sourceId,
            generation: item.generation,
          })),
      });
      for (const candidate of identified.filter((item) =>
        selected.has(item.sourceId),
      ))
        state.observations.push({
          key: intakeSubmissionKey(
            binding.id,
            candidate.sourceId,
            candidate.generation,
          ),
          sourceId: candidate.sourceId,
          bindingId: binding.id,
          generation: candidate.generation,
          revision: candidate.sourceRevision,
          stableSince: now,
          admitted: false,
        });
      await this.ports.save(state);
    });
  }
  reconcile(
    binding: IntakeBinding,
    candidates: readonly IntakeCandidate[],
    now: number,
  ): Promise<IntakeResult[]> {
    return this.serial(async () => {
      const state = await this.ports.load();
      const activation = state.activations.find(
        (item) => item.bindingId === binding.id,
      );
      if (!binding.enabled || !activation)
        return candidates.map((note) => ({
          path: note.path,
          status: binding.enabled ? "inactive" : "disabled",
        }));
      const notes: (IntakeCandidate & { sourceId: string })[] = [];
      const results: IntakeResult[] = [];
      const invalidSourceIds = new Set<string>();
      for (const note of candidates) {
        if (!routeIntake([binding], note.path)) continue;
        if (note.error) {
          if (note.sourceId) invalidSourceIds.add(note.sourceId);
          results.push({
            path: note.path,
            status: "attention",
            reason: note.error,
          });
          continue;
        }
        try {
          notes.push(
            note.sourceId
              ? { ...note, sourceId: note.sourceId }
              : await this.ports.identify(note),
          );
        } catch {
          results.push({
            path: note.path,
            status: "attention",
            reason:
              "Cannot retain note identity. Repair note storage before submitting.",
          });
        }
      }
      const duplicates = new Set(
        notes
          .filter(
            (note) =>
              notes.filter((other) => other.sourceId === note.sourceId).length >
              1,
          )
          .map((note) => note.sourceId),
      );
      for (const id of invalidSourceIds) duplicates.add(id);
      for (const note of notes) {
        const result: IntakeResult = {
          path: note.path,
          sourceId: note.sourceId,
          status: "attention",
        };
        results.push(result);
        if (duplicates.has(note.sourceId)) {
          result.reason =
            "Duplicate source identity. Give the copied note a new identity before submitting.";
          continue;
        }
        try {
          await this.candidate(state, activation, binding, note, now, result);
        } catch {
          result.status = "attention";
          result.reason =
            "Admission could not be retained. Inspect storage and retry reconciliation; the source is preserved.";
        }
      }
      await this.ports.save(state);
      return results;
    });
  }
  private async candidate(
    state: IntakeState,
    activation: IntakeActivation,
    binding: IntakeBinding,
    note: IntakeCandidate & { sourceId: string },
    now: number,
    result: IntakeResult,
  ): Promise<void> {
    const key = intakeSubmissionKey(binding.id, note.sourceId, note.generation);
    const existing = state.observations.find((item) => item.key === key);
    if (existing?.admitted) {
      result.status = "admitted";
      return;
    }
    const baseline =
      activation.baselineSubmissions?.some(
        (item) =>
          item.sourceId === note.sourceId &&
          item.generation === note.generation,
      ) ??
      (activation.baselineSourceIds.includes(note.sourceId) &&
        note.generation === 0);
    if (baseline) {
      result.status = "baseline";
      return;
    }
    if (note.body.length > this.maxInputCharacters) {
      result.reason =
        "Input exceeds the configured size limit; shorten it before submitting.";
      return;
    }
    if (!note.body.trim() || note.hasHumanContent === false) {
      result.status = "empty";
      return;
    }
    let observation = existing;
    if (!observation) {
      if (state.observations.length >= this.maxObservations) {
        result.status = "deferred";
        result.reason =
          "Intake evidence capacity is full. Export and resolve retained work before admitting more.";
        return;
      }
      observation = {
        key,
        sourceId: note.sourceId,
        generation: note.generation,
        bindingId: binding.id,
        revision: note.sourceRevision,
        stableSince: now,
        admitted: false,
      };
      state.observations.push(observation);
    } else if (observation.revision !== note.sourceRevision) {
      observation.revision = note.sourceRevision;
      observation.stableSince = now;
    }
    if (note.draft) {
      result.status = "draft";
      return;
    }
    if (binding.submit === "ready" && !note.ready) {
      result.status = "not-ready";
      return;
    }
    if (now - observation.stableSince < binding.settleMs) {
      result.status = "settling";
      return;
    }
    // The durable journal owns the actual admission tombstone, including crash-after-commit recovery.
    const status = await this.ports.admit({
      key,
      bindingId: binding.id,
      sourceId: note.sourceId,
      generation: note.generation,
      path: note.path,
      content: note.body,
      sourceRevision: note.sourceRevision,
      projectId: binding.projectId,
      teamId: binding.teamId,
      target: structuredClone(binding.target),
    });
    observation.admitted = status !== "deferred";
    result.status = status === "duplicate" ? "admitted" : status;
    if (status === "deferred")
      result.reason =
        "The source or shared queue is not ready. Reconciliation will retry after the source settles and capacity is available.";
  }
}
