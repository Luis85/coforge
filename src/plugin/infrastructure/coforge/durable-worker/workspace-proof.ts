import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as timer, clearTimeout } from 'node:timers';
import type { WorkflowWorkspaceRecord } from '../../../features/coforge/application/workflow-workspace-ports';
import type { DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import type { DurableBuildSnapshot } from '../../../features/coforge/domain/durable-build';
import { agentGit, captureIncrement } from '../agent-worktree';
import { childEnvironment } from '../process';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { WorkerFiles } from './files';
import { inputHash } from './protocol';

const changed = () => new Error('The retained Build workspace identity changed. Preserve it and inspect again before recovery.');
export async function verifyRetainedWorkspace(record: WorkflowWorkspaceRecord): Promise<void> {
  if (!record.pointer || record.directoryDevice === undefined || record.directoryInode === undefined) throw changed();
  const info = await lstat(record.cwd);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(record.cwd) !== record.cwd || info.dev !== record.directoryDevice || info.ino !== record.directoryInode) throw changed();
  const pointer = await lstat(join(record.cwd, '.git'));
  if (!pointer.isFile() || pointer.isSymbolicLink() || pointer.nlink !== 1 || pointer.size > 4096 || await readFile(join(record.cwd, '.git'), 'utf8') !== record.pointer) throw changed();
  if ((await agentGit(record.cwd, ['rev-parse', 'HEAD'])).trim() !== record.baseCommit || (await agentGit(record.cwd, ['symbolic-ref', '--short', 'HEAD'])).trim() !== record.branch) throw changed();
}
async function trackedDiffHash(record: WorkflowWorkspaceRecord): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256'); let failed = false;
    const child = spawn('git', ['-c', 'core.hooksPath=' + record.cwd + '/.coforge-disabled-hooks', '-c', 'core.fsmonitor=false', '-c', 'diff.external=',
      'diff', '--no-ext-diff', '--no-textconv', '--binary', '--no-color', record.baseCommit, '--'], { cwd: record.cwd, env: childEnvironment(), windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    const deadline = timer(() => { failed = true; child.kill(); reject(new Error('The retained workspace diff inspection exceeded its bounded phase budget.')); }, 30000);
    child.stdout.on('data', (chunk: Buffer) => hash.update(chunk));
    child.on('error', () => { clearTimeout(deadline); reject(changed()); });
    child.on('close', code => { clearTimeout(deadline); if (!failed) { if (code === 0) resolveHash(hash.digest('hex')); else reject(changed()); } });
  });
}
async function untrackedHash(record: WorkflowWorkspaceRecord): Promise<string> {
  const paths = (await agentGit(record.cwd, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean).sort();
  if (paths.length > 10000) throw new Error('Inspect this large retained workspace manually before recovery.');
  const hash = createHash('sha256');
  for (const path of paths) {
    const absolute = resolve(record.cwd, path); const inside = relative(record.cwd, absolute);
    if (!inside || inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) throw changed();
    const before = await lstat(absolute);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || await realpath(absolute) !== absolute) throw changed();
    hash.update(path + '\0' + before.size + '\0');
    for await (const chunk of createReadStream(absolute)) hash.update(chunk);
    const after = await lstat(absolute);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw changed();
  }
  return hash.digest('hex');
}
/** Reads the actual protected workspace; capture timestamps never participate in inspection consent. */
export async function inspectWorkerWorkspace(files: WorkerFiles, request: DurableBuildRequest, snapshot: DurableBuildSnapshot) {
  const records = workflowWorkspaceRecordsCheck(await files.read('workspaces.json', 8 * 1024 * 1024) ?? []);
  const record = records.find(item => item.runId === request.runId && (item.activeAttemptId === request.attemptId || item.lastAttemptId === request.attemptId));
  if (!record) {
    if (snapshot.workspaceId) throw changed();
    return { increment: undefined, record: undefined, evidenceHash: inputHash({ ref: snapshot.ref, inputHash: snapshot.ref.inputHash, workspace: null }) };
  }
  if (!record.id.startsWith('bg-') || record.projectId !== request.projectId || snapshot.workspaceId && snapshot.workspaceId !== record.id) throw changed();
  if (record.activeAttemptId && record.activeAttemptId !== request.attemptId) throw changed();
  await verifyRetainedWorkspace(record);
  const diffHash = await trackedDiffHash(record); const newHash = await untrackedHash(record);
  const increment = await captureIncrement(record.cwd, record.branch, 'Inspected retained background Build changes', undefined, { allowEmpty: true, baseCommit: record.baseCommit });
  await verifyRetainedWorkspace(record);
  const evidenceHash = inputHash({ ref: snapshot.ref, inputHash: snapshot.ref.inputHash,
    workspace: { id: record.id, projectId: record.projectId, runId: record.runId, cwd: record.cwd, branch: record.branch, baseCommit: record.baseCommit,
      pointer: record.pointer, device: record.directoryDevice, inode: record.directoryInode }, diffHash, newHash, previewDiff: increment.diff, files: increment.files });
  return { record, increment, evidenceHash };
}
