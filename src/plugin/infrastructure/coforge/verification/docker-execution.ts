import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { WorkflowVerificationProfile, WorkflowVerificationCommand } from '../../../features/coforge/domain/native-workflow-tools';
import type { WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';
import { list, record, shape, text } from '../../../features/coforge/domain/check';
import { captureProcess, ProcessOwnershipUnknown } from '../process';
import { attachVerification, type VerificationOutput } from './docker-attach';
import { assertVerificationSandbox, dockerControl, inspectVerificationRuntime, localDockerEndpoint, recoverVerificationRuntime, verificationContainerName, verificationDirectory, verificationEnvironment, verificationLabels, type VerificationCapture } from './runtime';
import { VERIFICATION_CONTAINER_RUNNER } from './container-runner';

export interface VerificationBackend {
  prepare(profile: WorkflowVerificationProfile): Promise<string>;
  execute(profile: WorkflowVerificationProfile, command: WorkflowVerificationCommand, identity: Omit<WorkflowVerificationRuntimeRecord, 'ownerToken' | 'phase' | 'startedAt' | 'terminalAt' | 'containerName'>, lifecycle: (record: WorkflowVerificationRuntimeRecord) => Promise<void>, signal?: AbortSignal, outputLimit?: number, hasDependencies?: boolean, onOutput?: (snapshot: VerificationOutput) => void): Promise<VerificationOutput & { exitCode?: number; unknown: boolean }>;
}

/** A real isolated engine is mandatory. Readiness never pulls images or weakens a policy. */
export class DockerVerificationBackend implements VerificationBackend {
  private imageEnvironmentNames: string[] = [];
  constructor(private readonly capture: VerificationCapture = captureProcess, private readonly attach = attachVerification) {}
  async prepare(profile: WorkflowVerificationProfile): Promise<string> {
    if (/\.(?:cmd|bat|ps1)$/iu.test(profile.dockerBin)) throw new Error('Choose the native Docker executable.');
    let endpoint: unknown;
    try { endpoint = JSON.parse((await this.capture(profile.dockerBin, ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], { cwd: process.cwd(), env: verificationEnvironment(), timeoutMs: 10000, maxBytes: 8000 })).trim()); }
    catch { throw new Error('Verification needs a running local Docker Linux engine. Open Docker Desktop, then check the saved verification profile.'); }
    if (typeof endpoint !== 'string' || !localDockerEndpoint(endpoint)) throw new Error('Verification accepts only a local Docker engine, never a remote context.');
    const info = shape({ OSType: text() })(JSON.parse(await dockerControl(profile.dockerBin, endpoint, ['info', '--format', '{{json .}}'], this.capture)));
    if (info.OSType !== 'linux') throw new Error('Verification requires Linux containers.');
    const values: unknown = JSON.parse(await dockerControl(profile.dockerBin, endpoint, ['image', 'inspect', profile.imageId], this.capture));
    if (!Array.isArray(values) || values.length !== 1 || record(values[0]).Id !== profile.imageId || record(values[0]).Os !== 'linux') throw new Error('The exact saved verification image is not available locally. Load it explicitly; CoForge never pulls an image.');
    const config = record(record(values[0]).Config);
    if (Object.keys(record(config.Volumes ?? {})).length) throw new Error('Verification images cannot declare automatic volumes.');
    this.imageEnvironmentNames = [...new Set(list(text({ max: 32000 }), { max: 256 })(config.Env ?? []).map(value => value.split('=')[0]!))];
    if (this.imageEnvironmentNames.some(name => !/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(name))) throw new Error('The verification image environment cannot be isolated safely.');
    return endpoint;
  }
  async execute(profile: WorkflowVerificationProfile, command: WorkflowVerificationCommand, identity: Omit<WorkflowVerificationRuntimeRecord, 'ownerToken' | 'phase' | 'startedAt' | 'terminalAt' | 'containerName'>, lifecycle: (record: WorkflowVerificationRuntimeRecord) => Promise<void>, signal?: AbortSignal, outputLimit?: number, hasDependencies = false, onOutput?: (snapshot: VerificationOutput) => void): Promise<VerificationOutput & { exitCode?: number; unknown: boolean }> {
    const directory = verificationDirectory(identity.verificationId);
    if (directory !== identity.sourceDirectory || /[,\r\n]/u.test(directory) || hasDependencies) throw new Error('Verification uses a private source snapshot and image-provided dependencies only.');
    await writeFile(join(directory, 'runner.cjs'), VERIFICATION_CONTAINER_RUNNER, { flag: 'wx', mode: 0o444 });
    await writeFile(join(directory, 'command.json'), JSON.stringify({ executable: command.executable, args: command.args, timeoutSeconds: profile.timeoutSeconds }), { flag: 'wx', mode: 0o444 });
    let runtime: WorkflowVerificationRuntimeRecord = { ...identity, containerName: verificationContainerName(identity.verificationId), ownerToken: randomBytes(32).toString('hex'), phase: 'prepared', startedAt: new Date().toISOString() };
    let persistenceFailed = false;
    const persist = async () => { try { await lifecycle(runtime); } catch (error) { persistenceFailed = true; throw error; } };
    await persist(); signal?.throwIfAborted();
    const bind = (source: string, target: string) => ['--mount', `type=bind,source=${join(directory, source)},destination=${target},readonly`];
    const labels = Object.entries(verificationLabels(runtime)).flatMap(([name, value]) => ['--label', `${name}=${value}`]);
    let observed: VerificationOutput = { output: '', truncated: false, interrupted: false }; let exitCode: number | undefined;
    try {
      await dockerControl(profile.dockerBin, runtime.endpoint, ['container', 'create', '--name', runtime.containerName, '--pull', 'never', '--init', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'SETUID', '--cap-add', 'SETGID', '--cap-add', 'KILL', '--security-opt', 'no-new-privileges', '--no-healthcheck', '--pids-limit', '128', '--memory', '1g', '--cpus', '2', '--user', '0:0', '--workdir', '/work', '--tmpfs', '/work:rw,nosuid,nodev,size=1073741824,mode=1777', '--tmpfs', '/tmp:rw,nosuid,nodev,size=268435456,mode=1777',
        ...this.imageEnvironmentNames.filter(name => name !== 'PATH').flatMap(name => ['--env', `${name}=`]), '--env', 'PATH=/usr/local/bin:/usr/bin:/bin',
        ...labels, ...bind('source', '/source'), ...bind('runner.cjs', '/coforge/runner.cjs'), ...bind('command.json', '/coforge/command.json'), '--entrypoint', '/usr/local/bin/node', profile.imageId, '/coforge/runner.cjs'], this.capture);
      runtime = { ...runtime, phase: 'created' }; await persist();
      const prepared = await inspectVerificationRuntime(runtime, this.capture);
      if (prepared === 'missing') throw new Error('The prepared container disappeared.');
      assertVerificationSandbox(prepared, runtime);
      signal?.throwIfAborted();
      runtime = { ...runtime, phase: 'started' }; await persist();
      observed = await this.attach(profile.dockerBin, runtime.endpoint, runtime.containerName, profile.timeoutSeconds, signal, outputLimit, onOutput);
      const state = await inspectVerificationRuntime(runtime, this.capture);
      if (state !== 'missing' && !state.State.Running && state.State.Status === 'exited' && !state.State.StartedAt.startsWith('0001-') && Number.isFinite(Date.parse(state.State.StartedAt))) exitCode = state.State.ExitCode;
    } catch { observed = { ...observed, interrupted: true }; }
    const settled = await recoverVerificationRuntime(runtime, this.capture);
    if (settled !== 'terminal') return { ...observed, exitCode, unknown: true };
    runtime = { ...runtime, phase: 'terminal', terminalAt: new Date().toISOString() }; await persist();
    if (persistenceFailed) throw new ProcessOwnershipUnknown('');
    return { ...observed, exitCode, unknown: false };
  }
}
