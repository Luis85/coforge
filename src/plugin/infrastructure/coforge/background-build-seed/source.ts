import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import { backgroundBuildRetrySourceCheck } from '../../../features/coforge/domain/background-build-retry';
import type { WorkflowWorkspaceRecord, WorkflowWorkspaceStorage } from '../../../features/coforge/application/workflow-workspace-ports';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { verifyRetainedWorkspace } from '../durable-worker/workspace-proof';
import { inputHash } from '../durable-worker/protocol';
import { agentGit, captureIncrement } from '../agent-worktree';
import { snapshotTree, invalidSnapshot } from './tree';
import { completeSnapshotPreview } from './preview';

export interface RetrySourceIdentity { projectRoot: string; cwd: string; baseCommit: string; branch: string; workspace?: WorkflowWorkspaceRecord;
  directoryDevice: number; directoryInode: number; gitDirectory: string; gitDevice: number; gitInode: number; gitPointer?: string }
export type RetrySourceOwner = { kind: 'attempt'; jobId: string; attemptId: string } | { kind: 'materialization'; id: string };
export interface RetrySourceSnapshot { source: BackgroundBuildRetrySource; sourceOwner?: RetrySourceOwner; identity: RetrySourceIdentity; tree: Awaited<ReturnType<typeof snapshotTree>>; evidenceHash: string; increment: Awaited<ReturnType<typeof captureIncrement>> | null }
const same = (a: string, b: string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
async function directoryIdentity(cwd: string) {
  const directory = await lstat(cwd); if (!directory.isDirectory() || directory.isSymbolicLink() || !same(await realpath(cwd), cwd)) throw invalidSnapshot();
  const control = await lstat(join(cwd, '.git'));
  if (control.isSymbolicLink() || !control.isDirectory() && (!control.isFile() || control.nlink !== 1 || control.size > 4096)) throw invalidSnapshot();
  const gitDirectory = await realpath(resolve(cwd, (await agentGit(cwd, ['rev-parse', '--git-common-dir'])).trim())); const git = await lstat(gitDirectory);
  if (!git.isDirectory() || git.isSymbolicLink()) throw invalidSnapshot();
  return { directoryDevice: directory.dev, directoryInode: directory.ino, gitDirectory, gitDevice: git.dev, gitInode: git.ino,
    ...(control.isFile() ? { gitPointer: await readFile(join(cwd, '.git'), 'utf8') } : {}) };
}
export async function verifyRetrySourceIdentity(source: BackgroundBuildRetrySource, identity: RetrySourceIdentity) {
  const projectRoot = await realpath((await agentGit(await realpath(resolve(source.projectPath)), ['rev-parse', '--show-toplevel'])).trim());
  if (!same(projectRoot, identity.projectRoot)) throw invalidSnapshot();
  const observed = await directoryIdentity(identity.cwd);
  const expected = { directoryDevice: identity.directoryDevice, directoryInode: identity.directoryInode, gitDirectory: identity.gitDirectory, gitDevice: identity.gitDevice, gitInode: identity.gitInode, ...(identity.gitPointer ? { gitPointer: identity.gitPointer } : {}) };
  if (inputHash(observed) !== inputHash(expected)) throw invalidSnapshot();
  if (identity.workspace) await verifyRetainedWorkspace(identity.workspace);
  else if (identity.cwd !== projectRoot || (await agentGit(projectRoot, ['rev-parse', '--verify', 'HEAD'])).trim() !== identity.baseCommit ||
    (await agentGit(projectRoot, ['status', '--porcelain', '--untracked-files=all'])).trim()) throw invalidSnapshot();
  const tree = await snapshotTree(identity.cwd, identity.baseCommit, source.sourceKind === 'repository');
  if (source.sourceKind === 'repository' && tree.changes.length) throw invalidSnapshot();
  if (identity.workspace) await verifyRetainedWorkspace(identity.workspace);
  return { tree, evidenceHash: inputHash({ source, identity, treeHash: tree.treeHash }) };
}
export async function captureRetrySource(sourceValue: BackgroundBuildRetrySource, storage: WorkflowWorkspaceStorage): Promise<RetrySourceSnapshot> {
  let source = backgroundBuildRetrySourceCheck(sourceValue); const records = workflowWorkspaceRecordsCheck(await storage.load());
  const configured = await realpath(resolve(source.projectPath)); const projectRoot = await realpath((await agentGit(configured, ['rev-parse', '--show-toplevel'])).trim());
  let identity: RetrySourceIdentity; let sourceOwner: RetrySourceOwner | undefined;
  if (source.sourceKind === 'workspace') {
    const record = records.find(item => item.id === source.sourceWorkspaceId);
    if (!record || record.runId !== source.runId || record.projectId !== source.projectId ||
      !same(await realpath(record.projectPath), record.id.startsWith('bg-') ? projectRoot : configured)) throw invalidSnapshot();
    const actualAttempt = record.activeAttemptId ?? record.lastAttemptId;
    if (!record.activeAttemptId && record.operatorMaterializationId && actualAttempt === record.operatorMaterializationId) sourceOwner = { kind: 'materialization', id: record.operatorMaterializationId };
    else {
      const owner = source.executorCandidates?.find(candidate => candidate.attemptId === actualAttempt) ??
        (source.sourceJobId && source.sourceAttemptId && source.sourceAttemptId === actualAttempt ? { jobId: source.sourceJobId, attemptId: source.sourceAttemptId } : undefined);
      if (!owner) throw new Error('Restore the canonical candidate for the actual original workspace lease before retrying.');
      sourceOwner = { kind: 'attempt', ...owner };
    }
    const resolved = sourceOwner; if (!resolved) throw invalidSnapshot();
    source = backgroundBuildRetrySourceCheck({ ...source,
      sourceJobId: resolved.kind === 'attempt' ? resolved.jobId : undefined,
      sourceAttemptId: resolved.kind === 'attempt' ? resolved.attemptId : undefined,
      sourceMaterializationId: resolved.kind === 'materialization' ? resolved.id : undefined });
    if (source.expectedIncrement && (source.expectedIncrement.simulated || source.expectedIncrement.worktree !== record.cwd || source.expectedIncrement.branch !== record.branch)) throw invalidSnapshot();
    await verifyRetainedWorkspace(record);
    const sourceCommon = await realpath(resolve(projectRoot, (await agentGit(projectRoot, ['rev-parse', '--git-common-dir'])).trim()));
    const workCommon = await realpath(resolve(record.cwd, (await agentGit(record.cwd, ['rev-parse', '--git-common-dir'])).trim()));
    if (!same(sourceCommon, workCommon)) throw invalidSnapshot();
    identity = { projectRoot, cwd: record.cwd, branch: record.branch, baseCommit: record.baseCommit, workspace: record, ...await directoryIdentity(record.cwd) };
  } else {
    if (!source.sourceIdentity && (!source.runId || records.some(record => record.runId === source.runId)) || source.sourceWorkspaceId || source.expectedIncrement && !source.expectedIncrement.simulated) throw invalidSnapshot();
    if ((await agentGit(projectRoot, ['status', '--porcelain', '--untracked-files=all'])).trim()) throw new Error('The captured repository must be clean before a fresh background Build.');
    source = backgroundBuildRetrySourceCheck({ ...source, sourceJobId: undefined, sourceAttemptId: undefined, sourceMaterializationId: undefined });
    identity = { projectRoot, cwd: projectRoot, branch: (await agentGit(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim(), baseCommit: (await agentGit(projectRoot, ['rev-parse', '--verify', 'HEAD'])).trim(), ...await directoryIdentity(projectRoot) };
  }
  const { tree, evidenceHash } = await verifyRetrySourceIdentity(source, identity);
  const increment = tree.changes.length ? await captureIncrement(identity.cwd, identity.branch, 'Reviewed partial work retained for background Build', undefined, { allowEmpty: true, baseCommit: identity.baseCommit }) : null;
  if (increment) { completeSnapshotPreview(increment, tree.changes); increment.snapshotHash = tree.treeHash; }
  return { source, ...(sourceOwner ? { sourceOwner } : {}), identity, tree, evidenceHash, increment };
}
