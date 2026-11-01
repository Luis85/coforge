import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../../features/coforge/application/workflow-workspace-ports';
import type { ProcessOptions } from '../../../infrastructure/coforge/process';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
const probes = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('../../../infrastructure/coforge/process', async original => ({ ...(await original<typeof import('../../../infrastructure/coforge/process')>()), captureProcess: probes.capture }));
vi.mock('../../../infrastructure/coforge/codex-model-profile', () => ({ writeCodexModelProfile: async () => '/private/model.json' }));
import { runCodexStage } from '../../../infrastructure/coforge/codex-runner';
import { ProviderOutput } from '../../../infrastructure/coforge/durable-worker/output';
import { codexResult } from '../../../features/coforge/application/codex-protocol';

it('keeps a real fake provider tree on one protected broker and captures only its root result and changes', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-native-provider-proof-')));
  const actual = await vi.importActual<typeof import('../../../infrastructure/coforge/process')>('../../../infrastructure/coforge/process');
  const home = join(root, 'auth-source'); await mkdir(home); await writeFile(join(home, 'auth.json'), 'OPAQUE_FAKE_AUTH');
  vi.stubEnv('CODEX_HOME', home); vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('CODEX_API_KEY', '');
  const onTokenUsage = vi.fn(); const onChanges = vi.fn(); const conversation: string[] = [];
  const processPhases: string[] = [];
  let privateDirectory: string | undefined;
  probes.capture.mockImplementation(async (_executable: string, args: readonly string[]) => {
    if (args[0] === '--version') return 'codex-cli 0.145.0';
    if (args.includes('--help')) return '--strict-config --ignore-user-config --ignore-rules --ephemeral --sandbox --json --output-schema';
    if (args[0] === 'features') return 'multi_agent_v2 stable true';
    if (args[0] === 'debug' && args[1] === 'models') return JSON.stringify({ models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v2' }] });
    if (args[0] === 'debug') return JSON.stringify(['There are 3 available concurrency slots, meaning that up to 3 agents can be active at once, including you.']);
    throw new Error('Unexpected inference through local capability probe');
  });
  const descendant = `
const url=process.argv[2]; const role=process.argv[3];
async function call(name,args){const reply=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+process.env.COFORGE_CODEX_MCP_TOKEN},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});return (await reply.json()).result;}
(async()=>{const denied=await call('coforge_read_file',{path:'.env'});if(!denied.isError)throw Error('Credential read escaped broker');
const managed=await call('coforge_read_file',{path:'Managed/request.md'});if(!managed.isError)throw Error('Managed read escaped broker');
if(role==='writer'){const result=await call('coforge_write_file',{path:'game.ts',expectedContent:'before',content:'after'});if(result.isError)throw Error('Scoped edit failed');}
else{const result=await call('coforge_read_file',{path:'game.ts'});if(result.isError)throw Error('Scoped read failed');}
process.stdout.write(JSON.stringify({type:'item.completed',agent:{agent_name:'/root/'+role},item:{type:'agent_message',text:JSON.stringify({summary:'CHILD_RESULT'})}})+'\\n');})().catch(()=>process.exitCode=2);
`;
  const coordinator = `
const fs=require('node:fs');const cp=require('node:child_process');let prompt='';process.stdin.on('data',chunk=>prompt+=chunk);process.stdin.on('end',async()=>{
try{if(!fs.existsSync(require('node:path').join(require('node:path').dirname(process.argv[2]),'process-identity.json')))throw Error('Provider started before launch evidence was saved');
const args=process.argv.slice(3);if(!args.includes('features.shell_tool=false')||!args.includes('features.multi_agent=false')||!args.some(arg=>arg.startsWith('features.multi_agent_v2={')&&arg.includes('max_concurrent_threads_per_session')))throw Error('Unexpected native policy');
const config=args.find(arg=>arg.startsWith('mcp_servers='));const url=JSON.parse(config.match(/"url" = ("[^"]+")/)[1]);
process.stdout.write(JSON.stringify({type:'thread.started',thread_id:'primary'})+'\\n');
const tasks=['writer','reader'].map(role=>new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,[process.argv[2],url,role],{env:process.env,stdio:['ignore','pipe','pipe']});child.stdout.pipe(process.stdout);child.on('close',code=>code===0?resolve():reject(Error('Descendant failed')));}));
await Promise.all(tasks);
process.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({summary:'Root implemented change'})}})+'\\n');
process.stdout.write(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:20,output_tokens:15}})+'\\n');
process.stdout.write(JSON.stringify({type:'item.completed',agent:{agent_name:'/root/late'},item:{type:'agent_message',text:'CHILD_LATE_RESULT'}})+'\\n');
}catch(error){process.stderr.write(error.message);process.exitCode=2;}});
`;
  await writeFile(join(root, 'descendant.cjs'), descendant); await writeFile(join(root, 'coordinator.cjs'), coordinator);
  await writeFile(join(root, 'game.ts'), 'before'); await writeFile(join(root, '.env'), 'contained fake secret');
  const lease: WorkflowWorkspaceLease = { cwd: root, id: 'workspace', protectedProjectPaths: ['Managed'], validate: async () => {}, release: vi.fn(async () => {}),
    capture: vi.fn(async summary => ({ summary, files: [{ path: 'game.ts', additions: 1, deletions: 1 }], tests: [], diff: '-before\n+after', simulated: false, createdAt: new Date().toISOString() })) };
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: { ...defaultSettings(), provider: 'codex', model: 'gpt-6.1-sol' }, integration: { ...defaultIntegration(), codexBin: 'synthetic-codex' }, onChanges, onTokenUsage,
    onNativeRuntime: async () => {},
    onNativeProcess: async record => { processPhases.push(record.phase); await writeFile(join(root, 'process-identity.json'), JSON.stringify(record)); },
    onConversation: async event => { if (event.kind === 'response') conversation.push(event.text); },
    workflow: { runId: 'run', definitionRevision: 'definition', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', provider: 'codex', model: 'gpt-6.1-sol', instructions: 'Implement', output: 'codechange', access: 'editworktree', automatic: false, nativeTools: { delegation: { maxConcurrent: 2 } } } } };
  const capture = async (_executable: string, args: readonly string[], options: ProcessOptions) => {
    privateDirectory = options.cwd;
    expect(options.cwd).not.toBe(root); expect(args).not.toContain(root);
    const raw = await actual.captureProcess(process.execPath, [join(root, 'coordinator.cjs'), join(root, 'descendant.cjs'), ...args], options);
    const durable = new ProviderOutput(true); durable.append(Buffer.from(raw));
    expect(codexResult(durable.result(), { delegated: true })).toMatchObject({ output: { summary: 'Root implemented change' } });
    return raw;
  };
  try {
    const result = await runCodexStage(input, { start: async () => {}, acquire: async () => lease, acknowledge: async () => {}, assertReviewable: async () => {} }, capture);
    expect(await readFile(join(root, 'game.ts'), 'utf8')).toBe('after');
    expect(result.summary).toBe('Root implemented change'); expect(result.increment?.files.map(file => file.path)).toEqual(['game.ts']);
    expect(conversation).toEqual(['{"summary":"Root implemented change"}']);
    expect(result.usage).toBeUndefined(); expect(onTokenUsage).not.toHaveBeenCalled();
    expect(onChanges).toHaveBeenCalledOnce(); expect(lease.release).toHaveBeenCalledOnce();
    expect(processPhases).toEqual(['launched', 'terminated', 'terminated']);
    expect(privateDirectory).toBeDefined();
    await expect(readFile(join(privateDirectory!, 'codex-home', 'auth.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); probes.capture.mockReset(); vi.unstubAllEnvs(); }
}, 30000);

it('retains private state and canonical authentication when original provider-tree termination is unknown', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-native-unknown-proof-')));
  const actual = await vi.importActual<typeof import('../../../infrastructure/coforge/process')>('../../../infrastructure/coforge/process');
  const home = join(root, 'auth-source'); await mkdir(home); await writeFile(join(home, 'auth.json'), 'OPAQUE_FAKE_AUTH');
  vi.stubEnv('CODEX_HOME', home); vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('CODEX_API_KEY', '');
  probes.capture.mockImplementation(async (_executable: string, args: readonly string[]) => args[0] === '--version' ? 'codex-cli 0.145.0'
    : args.includes('--help') ? '--strict-config --ignore-user-config --ignore-rules --ephemeral --sandbox --json --output-schema' : args[0] === 'debug' ? args[1] === 'models'
      ? JSON.stringify({ models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v2' }] }) : JSON.stringify(['There are 2 available concurrency slots, meaning that up to 2 agents can be active at once, including you.']) : 'multi_agent_v2 stable true');
  const release = vi.fn(async () => {});
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, settings: { ...defaultSettings(), provider: 'codex', model: 'gpt-6.1-sol' }, integration: { ...defaultIntegration(), codexBin: 'synthetic-codex' },
    onNativeRuntime: async () => {},
    workflow: { runId: 'run', definitionRevision: 'definition', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [],
      step: { id: 'review', name: 'Review', kind: 'ai', provider: 'codex', model: 'gpt-6.1-sol', instructions: 'Inspect', output: 'markdown', access: 'readproject', automatic: false, nativeTools: { delegation: { maxConcurrent: 1 } } } } };
  let retainedDirectory: string | undefined;
  const capture = async (_executable: string, _args: readonly string[], options: ProcessOptions): Promise<string> => {
    retainedDirectory = options.cwd; throw new actual.ProcessOwnershipUnknown('');
  };
  try {
    await expect(runCodexStage(input, { start: async () => {}, acquire: async () => ({ cwd: root, readOnly: true, validate: async () => {}, capture: async () => undefined, release }), acknowledge: async () => {}, assertReviewable: async () => {} }, capture)).rejects.toBeInstanceOf(actual.ProcessOwnershipUnknown);
    expect(release).toHaveBeenCalledWith(true);
    expect(await readdir(join(retainedDirectory!, 'codex-home'))).toEqual(['logs', 'sqlite']);
    await expect(readFile(join(retainedDirectory!, 'codex-home', 'auth.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(home, 'auth.json'), 'utf8')).toBe('OPAQUE_FAKE_AUTH');
  } finally {
    // This test's fake provider never started; explicit fixture cleanup is safe.
    if (retainedDirectory) await rm(retainedDirectory, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true }); probes.capture.mockReset(); vi.unstubAllEnvs();
  }
});
