import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { captureProcess, ProcessFailure, type ProcessOptions } from '../../../infrastructure/coforge/process';
import { readNativeProcessIdentity, sameNativeProcessIdentity, type NativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';
import { runClaudeStage } from '../../../infrastructure/coforge/claude-runner';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { record, text } from '../../../features/coforge/domain/check';

const posix = it.skipIf(process.platform !== 'linux' && process.platform !== 'darwin');
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe POSIX fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir('.nq', { recursive: true }); const root = await mkdtemp(join(resolve('.nq'), 'managed-posix-')); roots.push(root); return root;
}
posix('executes a real scoped Linux/macOS refinement without a Windows controller, a saved task deadline or a tool-count stop', async () => {
  const root = await fixture(); await writeFile(join(root, 'game.ts'), 'export const radius = 2;\n');
  const release = vi.fn(async () => {}), capture = vi.fn(async () => undefined), onChanges = vi.fn(), onNativeProcess = vi.fn();
  const lease = { id: 'source', cwd: root, readOnly: true as const, protectedProjectPaths: [], validate: async () => {}, capture, release };
  const workspaces = { start: async () => {}, acquire: async () => lease, assertReviewable: async () => {}, acknowledge: async () => {} };
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, integration: defaultIntegration(), settings: { ...defaultSettings(), maxTurns: 1, maxBudgetUsd: 0.1 },
    workflow: { runId: 'posix', attemptId: 'refine', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], lifecycle: { version: 1, mode: 'managed-session' },
      step: { id: 'refine', name: 'Refine', kind: 'ai', provider: 'claude', model: 'sonnet', instructions: 'Read the source', output: 'markdown', access: 'readproject', automatic: false } },
    onChanges, onNativeProcess, onWorkspace: async () => {} };
  let invocations = 0;
  const transport = async (_command: string, args: readonly string[], options: ProcessOptions) => {
    invocations++;
    expect(options.managedSession).toBe(true); expect(options.timeoutMs).toBeUndefined(); expect(options.nativeCoding).toBeUndefined(); expect(options.ownedTree).toBeUndefined();
    expect(args).not.toContain('--max-turns'); expect(args).not.toContain('--max-budget-usd'); expect(args[args.indexOf('--tools') + 1]).not.toContain('Bash');
    const config = record(JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8'))), server = record(record(config.mcpServers).coforge);
    const script = `process.stdin.resume();process.stdin.once('end',async()=>{for(let id=0;id<4;id++){const r=await fetch(process.argv[1],{method:'POST',headers:{Authorization:process.argv[2],'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'coforge_read_file',arguments:{path:'game.ts'}}})});const value=await r.json();if(value.error||!value.result||value.result.isError||!value.result.content?.some(row=>row.type==='text'&&row.text.includes('export const radius = 2;')))throw Error('Scoped read failed');}await new Promise(r=>setTimeout(r,150));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{markdown:'# Actual scoped refinement'},total_cost_usd:0}));});`;
    return captureProcess(process.execPath, ['-e', script, text()(server.url), text()(record(server.headers).Authorization)], { ...options, timeoutMs: 20 });
  };
  const result = await runClaudeStage(input, workspaces, transport);
  expect(result.markdown).toBe('# Actual scoped refinement'); expect(invocations).toBe(1);
  expect(capture).not.toHaveBeenCalled(); expect(onChanges).not.toHaveBeenCalled(); expect(onNativeProcess).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledWith(undefined); expect(await readFile(join(root, 'game.ts'), 'utf8')).toBe('export const radius = 2;\n');
});
posix('keeps an actual quiet SDK alive after prompt EOF without imposing the legacy default task deadline', async () => {
  const root = await fixture();
  const result = await captureProcess(process.execPath, ['-e', `process.stdin.resume();process.stdin.once('end',()=>setTimeout(()=>console.log('actual final'),150));`],
    { cwd: root, input: '', managedSession: true, timeoutMs: 20 });
  expect(result.trim()).toBe('actual final');
});
posix('fails an actual closed root output transport and stops its original group instead of accepting an earlier candidate', async () => {
  const root = await fixture(), pids = join(root, 'pids.json'), heartbeat = join(root, 'heartbeat');
  const writer = `const fs=require('node:fs');setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'x'),20)`;
  const script = `const fs=require('node:fs'),{spawn}=require('node:child_process');process.stdin.resume();process.stdin.once('end',()=>{const child=spawn(process.execPath,['-e',${JSON.stringify(writer)}],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pids)},JSON.stringify([process.pid,child.pid]));process.stdout.write(JSON.stringify({type:'result',subtype:'success',structured_output:{markdown:'# Earlier candidate'}}),()=>{fs.closeSync(1);});setInterval(()=>{},1000);});`;
  const run = captureProcess(process.execPath, ['-e', script], { cwd: root, input: '', managedSession: true }).then(() => undefined, (error: unknown) => error);
  const originals: NativeProcessIdentity[] = [];
  try {
    await vi.waitFor(async () => expect(await readFile(pids, 'utf8')).toBeTruthy());
    const ids: unknown = JSON.parse(await readFile(pids, 'utf8'));
    if (!Array.isArray(ids)) throw new Error('Invalid synthetic process record');
    for (const id of ids) { if (typeof id !== 'number') throw new Error('Invalid synthetic PID'); const identity = await readNativeProcessIdentity(id); if (identity) originals.push(identity); }
    const error = await run; expect(error).toBeInstanceOf(ProcessFailure);
    expect(error).toMatchObject({ failure: { code: 'incomplete_output' } });
    for (const identity of originals) expect(await readNativeProcessIdentity(identity.pid)).toBeUndefined();
    const before = await readFile(heartbeat, 'utf8'); await new Promise(resolve => setTimeout(resolve, 100)); expect(await readFile(heartbeat, 'utf8')).toBe(before);
  } finally {
    for (const identity of originals) {
      const current = await readNativeProcessIdentity(identity.pid);
      if (current && sameNativeProcessIdentity(identity, current)) { try { process.kill(identity.pid, 'SIGKILL'); } catch { /* Only the fixture's still-matching original may be stopped. */ } }
    }
  }
}, 12000);
