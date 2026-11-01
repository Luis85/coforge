import { lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';
import { captureProcess, type ProcessOptions } from '../process';
import { boolean, list, number, optional, record, shape, text } from '../../../features/coforge/domain/check';

export type VerificationCapture = (executable: string, args: readonly string[], options: ProcessOptions) => Promise<string>;
export const verificationRoot = () => join(realpathSync.native(tmpdir()), 'coforge-workflow-verification');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;

export function localDockerEndpoint(endpoint: string): boolean {
  return /^npipe:\/\/\/\/\.\/pipe\/[a-zA-Z0-9_.-]+$/u.test(endpoint) || /^unix:\/\/\/[^\0\r\n]+$/u.test(endpoint);
}
export function verificationDirectory(id: string): string {
  if (!uuid.test(id)) throw new Error('Invalid verification identity.');
  return join(verificationRoot(), id);
}
async function privateRoot(): Promise<string> {
  const root = resolve(verificationRoot());
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== root) throw new Error('Verification storage is not a canonical private directory.');
  return root;
}
export async function prepareVerificationDirectory(id: string): Promise<string> {
  await privateRoot();
  const directory = verificationDirectory(id);
  await mkdir(directory, { mode: 0o700 });
  return directory;
}
export async function removeVerificationDirectory(id: string): Promise<void> {
  await privateRoot();
  const directory = verificationDirectory(id);
  try { if ((await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Verification storage identity changed.'); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return; throw error; }
  await rm(directory, { recursive: true, force: true });
}

/** Docker receives no model/provider credentials, proxy settings or inherited Docker context. */
export function verificationEnvironment(): NodeJS.ProcessEnv {
  const allowed = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'LANG', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'];
  return Object.fromEntries(Object.entries(process.env).filter(([key, value]) => allowed.includes(key) && value !== undefined));
}
export async function dockerControl(executable: string, endpoint: string, args: readonly string[], capture: VerificationCapture = captureProcess): Promise<string> {
  if (!localDockerEndpoint(endpoint) || /\.(?:cmd|bat|ps1)$/iu.test(executable)) throw new Error('Verification requires a native Docker CLI and a local engine.');
  const root = await privateRoot(); const config = join(root, 'client');
  await mkdir(config, { recursive: true, mode: 0o700 });
  if ((await lstat(config)).isSymbolicLink() || await realpath(config) !== config) throw new Error('Verification client storage changed.');
  return capture(executable, ['--config', config, '--host', endpoint, ...args], { cwd: root, env: verificationEnvironment(), timeoutMs: 10000, maxBytes: 256000 });
}
export const verificationContainerName = (id: string) => { verificationDirectory(id); return `coforge-verification-${id}`; };
export function verificationLabels(record: WorkflowVerificationRuntimeRecord): Record<string, string> {
  return { 'coforge.verification.id': record.verificationId, 'coforge.verification.owner': record.ownerToken,
    'coforge.verification.run': record.runId, 'coforge.verification.attempt': record.attemptId, 'coforge.verification.source': record.sourceHash };
}

const inspection = shape({ Name: text(), Image: text(), Config: shape({ Labels: record, User: optional(text()) }),
  State: shape({ Running: boolean, Status: text(), StartedAt: text(), FinishedAt: text(), ExitCode: number({ integer: true }), OOMKilled: optional(boolean) }),
  HostConfig: shape({ NetworkMode: text(), ReadonlyRootfs: boolean, Privileged: optional(boolean), CapDrop: optional(list(text())), CapAdd: optional(list(text())), SecurityOpt: optional(list(text())), PidsLimit: optional(number()), Memory: optional(number()), NanoCpus: optional(number()), PidMode: optional(text()), Tmpfs: optional(record) }),
  Mounts: list(shape({ Type: text(), Source: optional(text()), Destination: text(), RW: optional(boolean) })) });
type Inspection = ReturnType<typeof inspection>;
function mountedPath(path: string): string {
  const mapped = process.platform === 'win32' ? /^\/(?:run\/desktop\/mnt\/host|host_mnt)\/([a-z])\/(.*)$/iu.exec(path) : null;
  const value = resolve(mapped ? `${mapped[1]}:/${mapped[2]}` : path);
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
export async function inspectVerificationRuntime(record: WorkflowVerificationRuntimeRecord, capture: VerificationCapture = captureProcess): Promise<Inspection | 'missing'> {
  if (record.containerName !== verificationContainerName(record.verificationId) || resolve(record.sourceDirectory) !== resolve(verificationDirectory(record.verificationId)) || !/^[a-f0-9]{64}$/u.test(record.ownerToken)) throw new Error('Verification ownership identity is invalid.');
  let raw: string;
  try { raw = await dockerControl(record.dockerBin, record.endpoint, ['container', 'inspect', record.containerName], capture); }
  catch {
    const names = await dockerControl(record.dockerBin, record.endpoint, ['container', 'ls', '--all', '--filter', `name=^/${record.containerName}$`, '--format', '{{.Names}}'], capture);
    if (!names.trim()) return 'missing';
    throw new Error('Verification container state is unavailable.');
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error('Verification container identity is unavailable.');
  const value = inspection(parsed[0]);
  const labels = verificationLabels(record);
  if (value.Name !== '/' + record.containerName || value.Image !== record.imageId || Object.entries(labels).some(([key, item]) => value.Config.Labels[key] !== item)) throw new Error('The original verification container cannot be attributed safely.');
  return value;
}

/** Validate the complete execution boundary before starting any repository code. */
export function assertVerificationSandbox(value: Inspection, runtime: WorkflowVerificationRuntimeRecord): void {
  const host = value.HostConfig;
  const additions = host.CapAdd?.map(capability => capability.replace(/^CAP_/u, '')).sort();
  if (host.NetworkMode !== 'none' || !host.ReadonlyRootfs || host.Privileged || host.PidMode === 'host' || host.PidsLimit !== 128 || host.Memory !== 1073741824 || host.NanoCpus !== 2000000000
    || !host.CapDrop?.includes('ALL') || JSON.stringify(additions) !== JSON.stringify(['KILL', 'SETGID', 'SETUID']) || !host.SecurityOpt?.some(value => /^no-new-privileges(?::true)?$/u.test(value)) || value.Config.User !== '0:0') throw new Error('The container isolation policy was not enforced.');
  const expected: Record<string, string> = { '/source': join(runtime.sourceDirectory, 'source'), '/coforge/runner.cjs': join(runtime.sourceDirectory, 'runner.cjs'), '/coforge/command.json': join(runtime.sourceDirectory, 'command.json') };
  const binds = value.Mounts.filter(mount => mount.Type === 'bind');
  if (binds.length !== 3 || new Set(binds.map(mount => mount.Destination)).size !== 3 || value.Mounts.some(mount => mount.Type !== 'bind' && (mount.Type !== 'tmpfs' || !['/work', '/tmp'].includes(mount.Destination)))
    || binds.some(mount => !expected[mount.Destination] || mountedPath(mount.Source ?? '') !== mountedPath(expected[mount.Destination]!) || mount.RW !== false)
    || JSON.stringify(Object.keys(host.Tmpfs ?? {}).sort()) !== JSON.stringify(['/tmp', '/work'])) throw new Error('The verification mount policy was not enforced.');
}

/** Never reconstruct execution or signal a container using only its reused name. */
export async function recoverVerificationRuntime(record: WorkflowVerificationRuntimeRecord, capture: VerificationCapture = captureProcess): Promise<'terminal' | 'unknown'> {
  if (record.phase === 'terminal') return 'terminal';
  try {
    const state = await inspectVerificationRuntime(record, capture);
    if (state !== 'missing') await dockerControl(record.dockerBin, record.endpoint, ['container', 'rm', '--force', record.containerName], capture);
    const after = await inspectVerificationRuntime(record, capture);
    if (after !== 'missing') return 'unknown';
    await removeVerificationDirectory(record.verificationId).catch(() => undefined);
    return 'terminal';
  } catch { return 'unknown'; }
}
