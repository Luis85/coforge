import type { Increment } from '../../../features/coforge/domain/types';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../../features/coforge/application/workflow-workspace-ports';
import type { WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';
import { DockerVerificationBackend, type VerificationBackend } from './docker-execution';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { shape, text } from '../../../features/coforge/domain/check';
import { workflowVerificationProfileCheck } from '../../../features/coforge/domain/native-workflow-tools';
import { cleanText } from '../../../features/coforge/domain/sanitize';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { ProcessOwnershipUnknown, redact } from '../process';
import { prepareVerificationDirectory, removeVerificationDirectory } from './runtime';
import { captureVerificationSource, verificationSourceIdentity } from './source';

function clippedOutput(value: string, limit: number): { output: string; truncated: boolean } {
  const bytes = Buffer.from(value);
  if (bytes.length <= limit) return { output: value, truncated: false };
  let end = Math.max(0, limit);
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return { output: bytes.subarray(0, end).toString('utf8'), truncated: true };
}

export interface WorkflowVerificationSession {
  records(): WorkflowVerificationRecord[];
  run(raw: unknown): Promise<WorkflowVerificationRecord>;
  capture(increment: Increment): Promise<Increment>;
  assertHealthy(): void;
  dispose(): Promise<void>;
}
export async function createWorkflowVerification(input: StageInput, lease: WorkflowWorkspaceLease, backend: VerificationBackend = new DockerVerificationBackend()): Promise<WorkflowVerificationSession | undefined> {
  if (!input.workflow?.verificationProfile) return;
  const workflow = input.workflow;
  if (!workflow.step.nativeTools?.verification || !['claude', 'codex'].includes(workflow.step.provider) || workflow.step.access === 'none' || lease.protectedProjectPaths === undefined
    || !input.onVerification || !input.onVerificationRuntime) throw new Error('The captured verification authority and durable evidence callbacks are unavailable.');
  const profile = workflowVerificationProfileCheck(workflow.verificationProfile);
  if (!profile.enabled) throw new Error('Verification is not enabled for this attempt.');
  const endpoint = await backend.prepare(profile);
  input.signal?.throwIfAborted();
  const evidence: WorkflowVerificationRecord[] = [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener('abort', abort, { once: true });
  let pending: Promise<unknown> = Promise.resolve(); let closed = false; let outputBytes = 0; let unknown = false;
  const fingerprint = async () => {
    const source = await captureVerificationSource(lease, undefined, AbortSignal.timeout(15000));
    return verificationSourceIdentity(source.sourceHash, profile.imageId);
  };
  const execute = async (raw: unknown): Promise<WorkflowVerificationRecord> => {
    if (closed || unknown) throw new Error('This verification invocation is closed or requires recovery.');
    controller.signal.throwIfAborted();
    const { commandId } = shape({ commandId: text({ min: 1, max: 80 }) }, { strict: true })(raw);
    const command = profile.commands.find(command => command.id === commandId && workflow.step.nativeTools?.verification?.commandIds.includes(command.id));
    if (!command) throw new Error('This command was not authorized in the captured verification profile.');
    if (evidence.length >= profile.maxRuns) throw new Error('The captured verification run limit was reached.');
    const id = randomUUID(); const directory = await prepareVerificationDirectory(id);
    let retained = false; let reservation: WorkflowVerificationRecord | undefined;
    try {
      const source = await captureVerificationSource(lease, join(directory, 'source'), controller.signal);
      await mkdir(join(directory, 'source'), { recursive: true });
      const sourceHash = verificationSourceIdentity(source.sourceHash, profile.imageId);
      const record: WorkflowVerificationRecord = { id, runId: workflow.runId, attemptId: workflow.attemptId, projectId: ideaProjectId(input.idea), ...(lease.id ? { workspaceId: lease.id } : {}), commandId,
        label: command.label, executable: command.executable, args: [...command.args], runtime: 'docker', imageId: profile.imageId, sourceHash, startedAt: new Date().toISOString(), status: 'running', output: '', truncated: false };
      reservation = record; evidence.push(record); await input.onVerification!(record);
      let ownerToken = '';
      const observed = await backend.execute(profile, command, { verificationId: id, endpoint, dockerBin: profile.dockerBin, imageId: profile.imageId, runId: workflow.runId, attemptId: workflow.attemptId,
        projectId: record.projectId, sourceDirectory: directory, sourceHash, commandId }, async runtime => {
        ownerToken = runtime.ownerToken; await input.onVerificationRuntime!(runtime); if (runtime.phase !== 'terminal') retained = true; else retained = false;
      }, controller.signal, Math.max(0, Math.min(8192, 65536 - outputBytes)));
      let output = redact(observed.output).split(directory).join('[private snapshot]');
      if (ownerToken) output = output.split(ownerToken).join('[private ownership]');
      const clipped = clippedOutput(cleanText(output, 200000), Math.max(0, Math.min(8192, 65536 - outputBytes)));
      output = clipped.output; outputBytes += Buffer.byteLength(output);
      const status = observed.unknown ? 'unknown' : observed.interrupted || controller.signal.aborted || observed.exitCode === 124 ? 'interrupted' : observed.exitCode === 0 ? 'completed' : observed.exitCode !== undefined ? 'failed' : 'unavailable';
      const completed: WorkflowVerificationRecord = { ...record, status, ...(observed.exitCode === undefined ? {} : { exitCode: observed.exitCode }), finishedAt: new Date().toISOString(), output, truncated: observed.truncated || clipped.truncated };
      await input.onVerification!(completed); evidence[evidence.length - 1] = completed;
      if (observed.unknown) { unknown = true; throw new ProcessOwnershipUnknown(''); }
      return structuredClone(completed);
    } catch (error) {
      if (reservation) {
        unknown = true;
        const index = evidence.findIndex(record => record.id === reservation!.id);
        if (index >= 0 && evidence[index]!.status === 'running') evidence[index] = { ...reservation, status: 'unknown', finishedAt: new Date().toISOString(), output: 'The original command outcome or its durable persistence could not be confirmed. Inspect the retained execution before retrying.' };
      }
      throw error;
    } finally { if (!retained) await removeVerificationDirectory(id); }
  };
  return {
    records: () => structuredClone(evidence),
    assertHealthy() { if (unknown) throw new ProcessOwnershipUnknown(''); },
    run(raw) { const next = pending.then(() => execute(raw)); pending = next.catch(() => undefined); return next; },
    async capture(increment) {
      if (!evidence.length) return increment;
      let currentHash: string | undefined;
      if (!unknown) { try { currentHash = await fingerprint(); } catch { /* Retain changes and historical evidence when final source identity is unavailable. */ } }
      return { ...increment, verification: structuredClone(evidence), verificationSourceHash: currentHash, tests: [
        ...increment.tests.filter(note => !note.startsWith('Not run: shell tools are disabled.')),
        'Observed isolated command outcomes are recorded below. Check their source identity and limitations; command completion does not verify every acceptance criterion.',
      ] };
    },
    async dispose() { closed = true; controller.abort(); await pending; input.signal?.removeEventListener('abort', abort); if (unknown) throw new ProcessOwnershipUnknown(''); },
  };
}
