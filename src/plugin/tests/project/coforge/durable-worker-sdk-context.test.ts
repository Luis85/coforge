import { build } from 'esbuild';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createDurableBuildClient } from '../../../infrastructure/coforge/durable-build-client';
import { workerEnvironment } from '../../../infrastructure/coforge/durable-worker/node-runtime';
import { childEnvironment, captureProcess } from '../../../infrastructure/coforge/process';
import { nativeIdentityCheck } from '../../../infrastructure/coforge/durable-worker/store';
import { stopOwnedProcessTree } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { record } from '../../../features/coforge/domain/check';
import { durableRequest } from './durable-worker-fixture';
import { verificationEnvironment } from '../../../infrastructure/coforge/verification/runtime';

const prefix = join(realpathSync.native(tmpdir()), 'coforge-worker-sdk-env-');
const roots: string[] = []; const workers: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of workers.splice(0)) {
    if (!resolve(directory).startsWith(prefix)) throw new Error('Unsafe SDK environment worker cleanup.');
    try {
      const daemon = record(JSON.parse(await readFile(join(directory, 'daemon.json'), 'utf8')));
      expect((await stopOwnedProcessTree(nativeIdentityCheck(daemon.identity))).treeConfirmed).toBe(true);
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(prefix)) throw new Error('Unsafe SDK environment fixture cleanup.'); await rm(root, { recursive: true, force: true }); }
});
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

it('forwards canonical Codex sign-in context through the detached worker without serializing keys or inheriting unrelated secrets', async () => {
  const root = await realpath(await mkdtemp(prefix)); roots.push(root);
  const sdkHome = join(root, 'original-sdk-home'); const vault = join(root, 'vault'); const project = join(root, 'game'); const directory = join(root, 'worker');
  for (const path of [sdkHome, vault, project]) await mkdir(path);
  await mkdir(join(sdkHome, 'skills', 'context-canary'), { recursive: true });
  await writeFile(join(sdkHome, 'AGENTS.md'), 'GLOBAL_AGENTS_CONTEXT_CANARY');
  await writeFile(join(sdkHome, 'skills/context-canary/SKILL.md'), 'GLOBAL_SKILL_CONTEXT_CANARY');
  const authBytes = '{"fixture":"SDK_OWNS_THE_AUTH_STORE"}\n'; await writeFile(join(sdkHome, 'auth.json'), authBytes);
  const openaiKey = 'FAKE_OPENAI_ENVIRONMENT_CANARY_ONLY'; const codexKey = 'FAKE_CODEX_ENVIRONMENT_CANARY_ONLY';
  vi.stubEnv('CODEX_HOME', sdkHome); vi.stubEnv('OPENAI_API_KEY', openaiKey); vi.stubEnv('CODEX_API_KEY', codexKey);
  vi.stubEnv('COFORGE_UNRELATED_SECRET', 'UNRELATED_ENVIRONMENT_CANARY'); vi.stubEnv('ELECTRON_RUN_AS_NODE', '1'); vi.stubEnv('NODE_OPTIONS', '--no-warnings');
  expect(workerEnvironment()).toMatchObject({ CODEX_HOME: sdkHome, OPENAI_API_KEY: openaiKey, CODEX_API_KEY: codexKey });
  for (const name of ['COFORGE_UNRELATED_SECRET', 'ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS']) expect(workerEnvironment()[name]).toBeUndefined();
  expect(childEnvironment().CODEX_HOME).toBeUndefined(); expect(childEnvironment().OPENAI_API_KEY).toBeUndefined();
  for (const name of ['CODEX_HOME', 'OPENAI_API_KEY', 'CODEX_API_KEY']) expect(verificationEnvironment()[name]).toBeUndefined();
  await captureProcess('git', ['init', '-q'], { cwd: project });
  const entry = resolve('src/plugin/infrastructure/coforge/durable-worker/runtime.ts').replaceAll('\\', '/');
  const transport = resolve('src/plugin/infrastructure/coforge/codex-transport.ts').replaceAll('\\', '/');
  const processModule = resolve('src/plugin/infrastructure/coforge/process.ts').replaceAll('\\', '/');
  const canary = `const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto');const keys=['CODEX_HOME','OPENAI_API_KEY','CODEX_API_KEY'];const value={digests:Object.fromEntries(keys.map(k=>[k,c.createHash('sha256').update(process.env[k]??'MISSING').digest('hex')])),agents:fs.readFileSync(p.join(process.env.CODEX_HOME,'AGENTS.md'),'utf8').includes('GLOBAL_AGENTS_CONTEXT_CANARY'),skill:fs.readFileSync(p.join(process.env.CODEX_HOME,'skills/context-canary/SKILL.md'),'utf8').includes('GLOBAL_SKILL_CONTEXT_CANARY'),unrelated:process.env.COFORGE_UNRELATED_SECRET??null};process.stdout.write(JSON.stringify(value));`;
  const bundled = await build({ stdin: { contents: `import {main} from ${JSON.stringify(entry)};import {codexEnvironment} from ${JSON.stringify(transport)};import {captureProcess} from ${JSON.stringify(processModule)};import {createHash} from 'node:crypto';
    void main(process.argv[3],async()=>{const keys=['CODEX_HOME','OPENAI_API_KEY','CODEX_API_KEY'];const worker=Object.fromEntries(keys.map(k=>[k,createHash('sha256').update(process.env[k]??'MISSING').digest('hex')]));const provider=JSON.parse(await captureProcess(process.execPath,['-e',${JSON.stringify(canary)}],{cwd:process.argv[3],env:codexEnvironment(),timeoutMs:5000}));return {summary:JSON.stringify({worker,provider})};});`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', target: 'node22', format: 'cjs', write: false, logLevel: 'silent' });
  const client = createDurableBuildClient({ privateDirectory: directory, workerSource: bundled.outputFiles[0]!.text, nodeExecutable: process.execPath, vaultDirectory: vault, protectedVaultFolders: () => ['CoForge'] });
  workers.push(directory); const request = durableRequest(); request.input.integration.projectPath = project;
  request.input.settings.provider = request.input.workflow.step.provider = 'codex'; request.input.settings.model = request.input.workflow.step.model = 'gpt-6.1-sol';
  const ref = await client.prepare(request); await client.start(ref);
  await expect.poll(async () => (await client.inspect(ref)).phase, { timeout: 15000 }).toBe('completed');
  const completed = await client.inspect(ref); const summary = record(JSON.parse(completed.result?.summary ?? '{}')); const provider = record(summary.provider);
  const expected = { CODEX_HOME: digest(sdkHome), OPENAI_API_KEY: digest(openaiKey), CODEX_API_KEY: digest(codexKey) };
  expect(summary.worker).toEqual(expected); expect(provider).toMatchObject({ digests: expected, agents: true, skill: true, unrelated: null });
  const persisted: string[] = [];
  const inspectFiles = async (path: string): Promise<void> => { for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name); if (entry.isDirectory()) await inspectFiles(child); else if (entry.isFile() && /\.(?:json|log|cjs)$/u.test(entry.name)) persisted.push(await readFile(child, 'utf8'));
  } };
  await inspectFiles(directory);
  for (const key of [openaiKey, codexKey, 'UNRELATED_ENVIRONMENT_CANARY', authBytes]) expect(persisted.join('\n')).not.toContain(key);
  expect(await readFile(join(sdkHome, 'auth.json'), 'utf8')).toBe(authBytes);
  expect(await readFile(join(sdkHome, 'AGENTS.md'), 'utf8')).toBe('GLOBAL_AGENTS_CONTEXT_CANARY');
  await client.acknowledge(ref, completed.sequence);
}, 30000);
