import { afterEach, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import type { StageInput } from '../../../src/plugin/features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../src/plugin/features/coforge/domain/seed';
import { McpWorktreeCommands } from '../../../src/plugin/infrastructure/coforge/mcp-worktree-commands';
import { cleanupNativeFixtures, nativeProcessFixture } from './fixture';

if (process.platform !== 'win32') throw new Error('This production MCP lifetime proof requires actual Windows; no skipped substitute qualifies it.');
afterEach(cleanupNativeFixtures);
async function fixture() {
  const f = await nativeProcessFixture(); const privateRoot = join(f.directory, 'private-journal'); await mkdir(privateRoot);
  const input: StageInput = { jobId: 'task', stage: 'implement', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' }, settings: defaultSettings(),
    integration: { ...defaultIntegration(), allowImplementation: true },
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'v1', proposalRevision: 'proposal', inputArtifacts: [], worktreeCoding: { version: 1, profile: 'mcp-worktree-v1' },
      step: { id: 'build', kind: 'ai', name: 'Build', instructions: 'Build', provider: 'claude', model: 'sonnet', access: 'editworktree', output: 'codechange', automatic: false, execution: { mode: 'background' } } } };
  const lease = { id: 'workspace', cwd: f.directory, validate: async () => {}, capture: async () => undefined, release: async () => {} };
  const commands = new McpWorktreeCommands(() => privateRoot);
  return { ...f, input, commands, lease };
}
it('runs a production MCP command with file/output/exit evidence, kills a detached descendant and replays its original key without effects', async () => {
  const f = await fixture(); const counter = join(f.directory, 'executions.txt'); const script = join(f.directory, 'command.cjs');
  await writeFile(script, `const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');fs.appendFileSync(${JSON.stringify(counter)},'x');const child=cp.spawn(process.execPath,[path.join(__dirname,'daemon.cjs')],{detached:true,stdio:'ignore',windowsHide:true});child.unref();const ready=setInterval(()=>{if(!fs.existsSync(${JSON.stringify(f.marker)}))return;clearInterval(ready);console.log('ACTUAL_MCP_OUTPUT')},20);setTimeout(()=>process.exit(1),8000).unref();`);
  const request = { command: `"${process.execPath}" "${script}"`, idempotencyKey: 'original', yieldTimeMs: 0 };
  try {
    const first = await f.commands.start(f.input, f.lease, request, () => {});
    await expect.poll(async () => { const result = await f.commands.status('CFP-001', 'task', first.id); if (result.status === 'failed' || result.status === 'unknown') throw new Error(JSON.stringify(result)); return result.status; }, { timeout: 15000 }).toBe('completed');
    const result = await f.commands.status('CFP-001', 'task', first.id);
    expect(result.exitCode).toBe(0); expect(result.output).toContain('ACTUAL_MCP_OUTPUT'); expect(await readFile(counter, 'utf8')).toBe('x');
    const stopped = await f.readMarker(); expect(stopped).toBeDefined(); await pause(250); expect(await f.readMarker()).toBe(stopped);
    const replay = await f.commands.start(f.input, f.lease, request, () => {}); expect(replay.id).toBe(first.id); expect(await readFile(counter, 'utf8')).toBe('x');
  } finally { expect((await f.commands.settle(f.input)).quiescent).toBe(true); }
});
it('keeps an actual background server owned until MCP task settlement and stops its detached child too', async () => {
  const f = await fixture(); await f.writeProvider(true);
  const command = await f.commands.start(f.input, f.lease, { command: `"${process.execPath}" "${f.script}"`, idempotencyKey: 'server', yieldTimeMs: 0 }, () => {});
  await expect.poll(f.readMarker, { timeout: 15000 }).not.toBeUndefined();
  expect((await f.commands.status('CFP-001', 'task', command.id)).status).toBe('running');
  const result = await f.commands.settle(f.input); expect(result.quiescent).toBe(true); expect(result.commands[0]?.status).toBe('interrupted');
  const stopped = await f.readMarker(); await pause(250); expect(await f.readMarker()).toBe(stopped);
});
it('preserves quoted paths/arguments and a genuine nonzero command exit without claiming a passing result', async () => {
  const f = await fixture(); const script = join(f.directory, 'command with spaces.cjs');
  await writeFile(script, "console.log(JSON.stringify({argument:process.argv[2]}));console.error('EXPECTED_EXIT_SEVEN');process.exit(7)");
  try {
    const command = await f.commands.start(f.input, f.lease, { command: `"${process.execPath}" "${script}" "value with spaces"`, idempotencyKey: 'negative', yieldTimeMs: 0 }, () => {});
    await expect.poll(async () => (await f.commands.status('CFP-001', 'task', command.id)).status, { timeout: 15000 }).toBe('failed');
    const result = await f.commands.status('CFP-001', 'task', command.id);
    expect(result.exitCode).toBe(7); expect(result.output).toContain('value with spaces'); expect(result.output).toContain('EXPECTED_EXIT_SEVEN');
  } finally { expect((await f.commands.settle(f.input)).quiescent).toBe(true); }
});
