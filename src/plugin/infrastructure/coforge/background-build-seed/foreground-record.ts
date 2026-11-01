import { oneOf, optional, shape, text, timestamp } from '../../../features/coforge/domain/check';
import { backgroundBuildSnapshotRefCheck, type BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import { durableBuildResultCheck } from '../../../features/coforge/domain/durable-build';
import { nativeWorkflowProcessRecordCheck } from '../../../features/coforge/domain/native-workflow-process';
import { inputHash } from '../durable-worker/protocol';
import { WorkerFiles } from '../durable-worker/files';
import { retrySeedDirectory } from './store';
import { invalidSnapshot } from './tree';

const id = text({ min: 1, max: 160 }), hash = text({ pattern: /^[a-f0-9]{64}$/u });
export const foregroundPolishingRecordCheck = shape({ version: oneOf([1] as const), kind: oneOf(['foreground-polishing'] as const),
  jobId: id, attemptId: id, runId: id, projectId: id, ideaId: id, polishingId: id, proposalRevision: id, sourceHash: id,
  baseline: backgroundBuildSnapshotRefCheck, executionHash: hash, pathsHash: hash, admissionHash: hash, state: oneOf(['prepared', 'copying', 'seeded', 'completed', 'failed', 'attention'] as const),
  createdAt: timestamp, workspaceId: optional(id), nativeProcess: optional(nativeWorkflowProcessRecordCheck), result: optional(durableBuildResultCheck),
}, { strict: true });
export type ForegroundPolishingRecord = ReturnType<typeof foregroundPolishingRecordCheck>;
export function foregroundPolishingAdmissionHash(record: Omit<ForegroundPolishingRecord, 'admissionHash' | 'state' | 'createdAt'>): string {
  return inputHash({ jobId: record.jobId, attemptId: record.attemptId, runId: record.runId, projectId: record.projectId, ideaId: record.ideaId,
    polishingId: record.polishingId, proposalRevision: record.proposalRevision, sourceHash: record.sourceHash, baseline: record.baseline,
    executionHash: record.executionHash, pathsHash: record.pathsHash });
}
export const foregroundPolishingFiles = (directory: string) => new WorkerFiles(new WorkerFiles(retrySeedDirectory(directory)).path('foreground-polishing'));
export const foregroundPolishingRecordName = (jobId: string) => 'attempt-' + inputHash(id(jobId)).slice(0, 48) + '.json';

/** Private paid-admission evidence. An operator copy or worker record can never substitute for this ledger. */
export class ForegroundPolishingLedger {
  readonly files: WorkerFiles;
  constructor(directory: string) { this.files = foregroundPolishingFiles(directory); }
  async read(jobId: string): Promise<ForegroundPolishingRecord | undefined> {
    await this.files.initialize(); const raw = await this.files.read(foregroundPolishingRecordName(jobId));
    if (raw === undefined) return; const record = foregroundPolishingRecordCheck(raw);
    if (record.jobId !== jobId || foregroundPolishingAdmissionHash(record) !== record.admissionHash) throw invalidSnapshot(); return record;
  }
  async create(record: ForegroundPolishingRecord): Promise<void> {
    if (foregroundPolishingAdmissionHash(record) !== record.admissionHash) throw invalidSnapshot();
    await this.files.initialize(); await this.files.create(foregroundPolishingRecordName(record.jobId), foregroundPolishingRecordCheck(record));
  }
  async write(record: ForegroundPolishingRecord): Promise<void> {
    const before = await this.read(record.jobId);
    if (!before || foregroundPolishingAdmissionHash(record) !== record.admissionHash || before.admissionHash !== record.admissionHash || before.attemptId !== record.attemptId || before.runId !== record.runId
      || before.projectId !== record.projectId || before.ideaId !== record.ideaId || inputHash(before.baseline) !== inputHash(record.baseline)) throw invalidSnapshot();
    await this.files.write(foregroundPolishingRecordName(record.jobId), foregroundPolishingRecordCheck(record));
  }
}
export async function completedForegroundPolishing(directory: string, source: BackgroundBuildRetrySource) {
  if (!source.sourceJobId || !source.sourceAttemptId || !source.sourceWorkspaceId || !source.runId) throw invalidSnapshot();
  const record = await new ForegroundPolishingLedger(directory).read(source.sourceJobId);
  if (!record || record.state !== 'completed' || !record.result || record.workspaceId !== source.sourceWorkspaceId || record.attemptId !== source.sourceAttemptId
    || record.runId !== source.runId || record.projectId !== source.projectId || record.ideaId !== source.ideaId
    || record.nativeProcess?.phase !== 'terminated' || !record.nativeProcess.lifetime || record.nativeProcess.privateRuntime
    || record.nativeProcess.runId !== record.runId || record.nativeProcess.attemptId !== record.attemptId || record.nativeProcess.projectId !== record.projectId) throw invalidSnapshot();
  return record;
}
