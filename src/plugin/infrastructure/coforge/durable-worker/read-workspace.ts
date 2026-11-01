import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Increment } from '../../../features/coforge/domain/types';
import type { WorkflowWorkspaceLease, WorkflowWorkspaceRequest } from '../../../features/coforge/application/workflow-workspace-ports';
import { durableBuildTerminal } from '../../../features/coforge/domain/durable-build';
import { list, text } from '../../../features/coforge/domain/check';
import { agentGit } from '../agent-worktree';
import { captureWorkflowIncrement as captureIncrement } from '../workflow-workspace-capture';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { WorkerFiles } from './files';
import { retainedJob } from './recovery';
import { workerRecordCheck, workerSnapshot } from './store';
import { inputHash } from './protocol';
import { protectedPrefix } from './protection';
import { verifyRetainedWorkspace } from './workspace-proof';
import { operatorWorkspaceRecord } from '../background-build-seed/operator-record';

const denied = () => new Error('The original background workspace must be terminal, attributable and unchanged before a read-only follow-up. Inspect its retained execution; no foreground editing authority was granted.');
const idsCheck = list(text({ pattern: /^build-[a-f0-9]{40}$/u }), { max: 1000 });
const equalPath = (left: string, right: string) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
async function gitRoot(directory: string): Promise<string> { return realpath((await agentGit(directory, ['rev-parse', '--show-toplevel'])).trim()); }
async function commonRoot(directory: string): Promise<string> { return realpath(resolve(directory, (await agentGit(directory, ['rev-parse', '--git-common-dir'])).trim())); }

async function originalAuthority(files: WorkerFiles, request: WorkflowWorkspaceRequest) {
  request.signal?.throwIfAborted();
  if (request.access !== 'readproject' || !request.workspaceId?.startsWith('bg-')) throw denied();
  const rows = workflowWorkspaceRecordsCheck(await files.read('workspaces.json', 8 * 1024 * 1024) ?? []);
  const workspace = rows.find(row => row.id === request.workspaceId);
  if (!workspace || workspace.runId !== request.runId || workspace.projectId !== request.projectId || workspace.phase !== 'ready' || workspace.activeAttemptId || !workspace.lastAttemptId) throw denied();
  await verifyRetainedWorkspace(workspace);
  const source = await gitRoot(request.integration.projectPath);
  if (!equalPath(source, await realpath(workspace.projectPath)) || !equalPath(await commonRoot(source), await commonRoot(workspace.cwd))) throw denied();
  const jobs = [];
  for (const id of idsCheck(await files.read('index.json') ?? [])) {
    const child = new WorkerFiles(files.path(id)); await child.attach();
    const record = workerRecordCheck(await child.read('record.json'));
    if (record.snapshot.ref.executionId !== id) throw denied();
    const job = await retainedJob(files, record.snapshot.ref);
    const pendingEpoch = job.request.input.workflow.backgroundRetryId ?? job.request.input.workflow.polishingId;
    if (job.record.snapshot.workspaceId === workspace.id || job.request.runId === workspace.runId && !job.record.snapshot.workspaceId &&
      (job.request.input.workflow.workspaceId === workspace.id || !job.request.input.workflow.workspaceId && pendingEpoch === workspace.workspaceEpoch)) jobs.push(job);
  }
  const operator = workspace.operatorMaterializationId ? await operatorWorkspaceRecord(files, workspace) : undefined;
  if (!jobs.length) {
    if (!operator || operator.binding?.mode !== 'background' || workspace.lastAttemptId !== workspace.operatorMaterializationId) throw denied();
    if (!equalPath(await gitRoot(operator.request.target.projectPath), source)) throw denied();
    return { workspace, expected: operator.binding.increment, identity: inputHash({ workspace, operator: operator.requestHash, binding: operator.binding.evidenceHash }),
      protectedProjectPaths: Object.freeze([...operator.protectedProjectPaths]) };
  }
  const protection = new Set<string>();
  for (const path of operator?.protectedProjectPaths ?? []) protection.add(protectedPrefix(path));
  const sources = new Map([[request.integration.projectPath, source]]);
  for (const job of jobs) {
    if (job.request.runId !== workspace.runId || job.request.projectId !== workspace.projectId || job.record.snapshot.workspaceId && job.record.snapshot.workspaceId !== workspace.id ||
      !durableBuildTerminal(job.record.snapshot.phase) || job.record.terminationUnknown || !Array.isArray(job.request.protectedProjectPaths)) throw denied();
    const originalPath = job.request.input.integration.projectPath;
    let originalRoot = sources.get(originalPath);
    if (!originalRoot) { originalRoot = await gitRoot(originalPath); sources.set(originalPath, originalRoot); }
    if (!equalPath(originalRoot, source)) throw denied();
    for (const prefix of job.request.protectedProjectPaths) protection.add(protectedPrefix(prefix));
  }
  const last = jobs.find(job => job.request.attemptId === workspace.lastAttemptId && job.record.snapshot.workspaceId === workspace.id);
  if (!last) throw denied();
  const snapshot = workerSnapshot(last.record);
  const expected = snapshot.workspaceCaptured ? snapshot.increment : snapshot.result?.increment ?? snapshot.increment;
  if (expected?.simulated || !expected && !snapshot.workspaceCaptured) throw denied();
  const identity = inputHash({ workspace, jobs: jobs.map(job => ({ ref: job.record.snapshot.ref, phase: job.record.snapshot.phase, known: !job.record.terminationUnknown,
    request: { runId: job.request.runId, projectId: job.request.projectId, attemptId: job.request.attemptId, protection: job.request.protectedProjectPaths } })) });
  return { workspace, expected, identity, protectedProjectPaths: Object.freeze([...protection].sort()) };
}

function sameChanges(actual: Increment, expected: Increment | undefined): boolean {
  return expected ? actual.diff === expected.diff && inputHash(actual.files) === inputHash(expected.files) && actual.branch === expected.branch && actual.worktree === expected.worktree &&
    (!expected.snapshotHash || actual.snapshotHash === expected.snapshotHash) : actual.files.length === 0 && actual.diff === '';
}

/** This read lease never adopts a worker writer or updates its private lease journal. */
export async function durableReadWorkspace(files: WorkerFiles, request: WorkflowWorkspaceRequest, assertReviewable: (id: string, expected?: Increment) => Promise<void>): Promise<WorkflowWorkspaceLease> {
  const captured = await originalAuthority(files, request);
  const actual = await captureIncrement(captured.workspace.cwd, captured.workspace.branch, captured.expected?.summary ?? 'Verified background workspace', undefined, { allowEmpty: true, baseCommit: captured.workspace.baseCommit });
  if (!sameChanges(actual, captured.expected)) throw denied();
  let closed = false;
  const validate = async () => {
    if (closed) throw denied();
    const current = await originalAuthority(files, request);
    if (current.identity !== captured.identity) throw denied();
    const observed = await captureIncrement(current.workspace.cwd, current.workspace.branch, actual.summary, undefined, { allowEmpty: true, baseCommit: current.workspace.baseCommit });
    if (!sameChanges(observed, actual)) throw denied();
    // Full scoped bytes were just compared above; the host callback rechecks live ownership and Git identity.
    await assertReviewable(current.workspace.id);
    request.signal?.throwIfAborted();
  };
  await validate();
  return { id: captured.workspace.id, cwd: captured.workspace.cwd, readOnly: true, protectedProjectPaths: captured.protectedProjectPaths,
    validate, capture: async () => undefined, release: async () => { closed = true; } };
}
