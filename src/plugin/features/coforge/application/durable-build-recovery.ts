import { durableBuildInspectionCheck, durableBuildTerminal, sameDurableBuildRef } from '../domain/durable-build';
import type { DurableBuildSnapshot } from '../domain/durable-build';
import type { StudioStore } from './studio-store';
import type { DurableBuildPort } from './durable-build-ports';
import { holdWorkflow } from './workflow-stop-policy';
import { recordOperation } from './population';

function context(store: StudioStore, ideaId: string, revision: number) {
  const idea = store.snapshot().ideas.find(item => item.id === ideaId); const run = idea?.workflowRun;
  if (!run || !Number.isInteger(revision) || run.revision !== revision) throw new Error('The workflow changed. Refresh and inspect its original retained evidence.');
  const job = store.durableBuildJobIds(ideaId).map(id => store.durableBuildJob(id)).find(item => item?.workflow?.runId === run.id && item.durable);
  if (!job?.durable) throw new Error('There is no unresolved original background execution to inspect.');
  return { idea, run, job, ref: job.durable.ref };
}

/** Offline inspection is evidence reading, not a heartbeat or a claim that the process has stopped. */
export async function inspectDurableBuildEvidence(store: StudioStore, port: DurableBuildPort | undefined, ideaId: string, revision: number) {
  if (!port) throw new Error('The native worker evidence reader is unavailable.');
  const original = context(store, ideaId, revision);
  const inspection = durableBuildInspectionCheck(await port.inspectRetained(original.ref));
  if (!sameDurableBuildRef(original.ref, inspection.ref) || !sameDurableBuildRef(inspection.ref, inspection.snapshot.ref)) throw new Error('The retained evidence belongs to a different original execution.');
  const current = context(store, ideaId, revision);
  if (current.job.id !== original.job.id || !sameDurableBuildRef(current.ref, original.ref)) throw new Error('The original execution changed during inspection.');
  await store.observeDurableBuildInspection(original.job.id, { ...inspection, ideaId, runId: original.run.id, runRevision: revision });
  return inspection;
}

/** Explicit operator recovery can only cancel/retire the original writer, never submit another provider request. */
export async function recoverDurableBuild(store: StudioStore, port: DurableBuildPort | undefined, ideaId: string, revision: number, consent: boolean, apply: (jobId: string, snapshot: DurableBuildSnapshot) => Promise<void>): Promise<void> {
  if (consent !== true) throw new Error('Explicit acknowledgement of retained evidence inspection is required.');
  if (!port) throw new Error('The native worker recovery verifier is unavailable.');
  const original = context(store, ideaId, revision); const receipt = store.durableBuildInspection(original.job.id);
  if (!receipt || receipt.ideaId !== ideaId || receipt.runId !== original.run.id || receipt.runRevision !== revision || !sameDurableBuildRef(receipt.ref, original.ref)) throw new Error('Inspect retained Build evidence again before acknowledging recovery.');
  await store.transaction(state => {
    const idea = state.ideas.find(item => item.id === ideaId);
    if (idea?.workflowRun?.id !== original.run.id || idea.workflowRun.revision !== revision) throw new Error('The workflow changed before recovery was authorized. Inspect again.');
    const { run } = holdWorkflow(state, ideaId);
    recordOperation(state, 'workflow-run-stopped', 'committed', undefined, 1, run.id);
  });
  const minimumSequence = Math.max(store.durableBuildSnapshot(original.job.id)?.sequence ?? 0, original.job.durable!.appliedSequence ?? 0);
  let snapshot: DurableBuildSnapshot;
  try { snapshot = await port.recover(original.ref, true, minimumSequence, receipt.evidenceHash); }
  catch {
    await store.transaction(state => { const run = state.ideas.find(idea => idea.id === ideaId)?.workflowRun; if (run?.id === original.run.id) { run.state = 'attention'; run.error = 'The original process remains unknown. Inspect retained evidence again; the stop hold remains.'; run.revision++; run.updatedAt = new Date().toISOString(); } });
    throw new Error('The original process remains unknown. Inspect retained evidence again; the stop hold remains.');
  }
  await apply(original.job.id, snapshot);
  if (!durableBuildTerminal(snapshot.phase)) throw new Error(snapshot.error ?? 'The original process remains unknown. Inspect retained evidence again before another recovery check.');
}
