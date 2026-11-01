import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentSessionTerminal, sessionTerminalEnvironment, type AgentSessionFollowSnapshot } from '../../../infrastructure/coforge/agent-session-terminal';
import { sessionFollowerSource } from '../../../infrastructure/coforge/agent-session-terminal-script';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { SessionTerminalNotStarted } from '../../../infrastructure/coforge/agent-session-terminal-launch';

const folders: string[] = [];
const observers: AgentSessionTerminal[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(observers.splice(0).map(observer => observer.dispose())); for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
const at = '2026-11-01T12:00:00.000Z';
const snapshot = (): AgentSessionFollowSnapshot => ({ label: 'Review', status: 'running', trace: appendAgentSessionEvent(undefined, { kind: 'message', sessionId: 'root', text: 'First visible observation' }, at) });

it('isolates the terminal environment from provider credentials, customization and Electron overrides', () => {
  expect(sessionTerminalEnvironment({ PATH: 'tools', SystemRoot: 'windows', OPENAI_API_KEY: 'private', CODEX_HOME: 'private', ANTHROPIC_AUTH_TOKEN: 'private',
    NODE_OPTIONS: '--require=private', ELECTRON_RUN_AS_NODE: '1', HOME: 'private', SHELL: 'private' })).toEqual({ PATH: 'tools', SystemRoot: 'windows' });
});

it('launches one read-only follower per admitted parent, sanitizes private/control text and follows bounded updates without invoking the provider', async () => {
  let current = snapshot(); let feedPath = '';
  const launch = vi.fn(async (directory: string) => { folders.push(directory); feedPath = join(directory, 'feed.json'); });
  const observer = new AgentSessionTerminal({ read: id => id === 'native-job' ? current : undefined, nodeExecutable: () => process.execPath, launch, intervalMs: 10 }); observers.push(observer);
  await expect(observer.open('foreign-job')).rejects.toThrow('session'); expect(launch).not.toHaveBeenCalled();
  await Promise.all([observer.open('native-job'), observer.open('native-job')]); expect(launch).toHaveBeenCalledOnce();
  expect(await readFile(feedPath, 'utf8')).toContain('First visible observation');
  current = { ...current, trace: appendAgentSessionEvent(current.trace, { kind: 'message', text: '\u001b]52;c;evil\u0007 C:\\Users\\private\\auth.json Bearer private-value' }, at) };
  await vi.waitFor(async () => {
    const feed = await readFile(feedPath, 'utf8'); expect(feed).toContain('[private path]'); expect(feed).not.toContain('auth.json'); expect(feed).not.toContain('private-value'); expect(feed).not.toContain('\\u001b');
  });
  current.trace.nextSequence = 1; // A broken current view must not prevent closing the observer.
  await observer.dispose(); expect(JSON.parse(await readFile(feedPath, 'utf8')).closed).toBe(true);
});

it('runs the actual fixed follower script against a synthetic feed, displays later observations and exits on feed closure without reading stdin', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-follow-script-')); folders.push(directory);
  const script = join(directory, 'follow.cjs'); const feed = join(directory, 'feed.json');
  await writeFile(script, sessionFollowerSource); await writeFile(feed, JSON.stringify({ version: 1, text: 'SYNTHETIC observation one ' + 'x'.repeat(200), closed: false }));
  const child = spawn(process.execPath, [script, feed], { env: sessionTerminalEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; child.stdout.on('data', chunk => { output += chunk.toString(); });
  const closed = new Promise<number | null>(resolve => child.once('close', resolve));
  try {
    await vi.waitFor(() => expect(output).toContain('SYNTHETIC observation one'));
    expect(Math.max(...output.split('\n').map(line => line.replaceAll('\u001b[2J', '').replaceAll('\u001b[H', '').length))).toBeLessThanOrEqual(80);
    child.stdin.write('DO_NOT_EXECUTE_INPUT\n');
    await writeFile(feed, JSON.stringify({ version: 1, text: 'SYNTHETIC observation two', closed: false }));
    await vi.waitFor(() => expect(output).toContain('SYNTHETIC observation two'), { timeout: 3000 }); expect(output).not.toContain('DO_NOT_EXECUTE_INPUT');
    await writeFile(feed, JSON.stringify({ version: 1, text: 'SYNTHETIC observation two', closed: true })); expect(await closed).toBe(0);
  } finally { if (child.exitCode === null) child.kill(); }
}, 10000);

it('closes a follower even when the current canonical display view becomes unavailable', async () => {
  let unavailable = false; let feedPath = '';
  const observer = new AgentSessionTerminal({ read: () => { if (unavailable) throw new Error('Synthetic view failure'); return snapshot(); }, nodeExecutable: () => process.execPath,
    launch: async directory => { folders.push(directory); feedPath = join(directory, 'feed.json'); } }); observers.push(observer);
  await observer.open('native-job'); unavailable = true;
  await observer.dispose(); expect(JSON.parse(await readFile(feedPath, 'utf8')).closed).toBe(true);
});

it('retires known closed observers and their feeds before reopening, freeing the finite follower slots', async () => {
  let open = true;
  const launch = vi.fn(async (directory: string) => { folders.push(directory); return { isOpen: async () => open }; });
  const observer = new AgentSessionTerminal({ read: () => snapshot(), nodeExecutable: () => process.execPath, launch, intervalMs: 10 }); observers.push(observer);
  await Promise.all(['one', 'two', 'three', 'four'].map(id => observer.open(id)));
  const initial = [...folders]; open = false;
  await vi.waitFor(async () => { for (const folder of initial) expect(await stat(folder).then(() => true, () => false)).toBe(false); });
  open = true; await observer.open('one'); await observer.open('five'); expect(launch).toHaveBeenCalledTimes(6);
});

it('does not multiply or remove an observer whose original liveness remains uncertain', async () => {
  let directory = '';
  const launch = vi.fn(async (folder: string) => { directory = folder; folders.push(folder); return { isOpen: async () => { throw new Error('Synthetic ownership uncertainty'); } }; });
  const observer = new AgentSessionTerminal({ read: () => snapshot(), nodeExecutable: () => process.execPath, launch, intervalMs: 10 }); observers.push(observer);
  await observer.open('one'); await observer.open('one'); expect(launch).toHaveBeenCalledOnce();
  expect(await stat(directory).then(() => true, () => false)).toBe(true);
});

it('bounds disposal when a cosmetic feed write stalls and eventually closes the feed once the write resumes', async () => {
  let directory = ''; let blocked = false; let resume: (() => void) | undefined;
  const observer = new AgentSessionTerminal({ read: () => snapshot(), nodeExecutable: () => process.execPath, intervalMs: 10,
    launch: async folder => { directory = folder; folders.push(folder); } }); observers.push(observer);
  await observer.open('one');
  const write = WorkerFiles.prototype.write;
  vi.spyOn(WorkerFiles.prototype, 'write').mockImplementation(async function(this: WorkerFiles, name, value) {
    if (!blocked && name === 'feed.json') { blocked = true; await new Promise<void>(resolve => { resume = resolve; }); }
    return write.call(this, name, value);
  });
  await vi.waitFor(() => expect(blocked).toBe(true));
  try {
    const settled = await Promise.race([observer.dispose().then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1500))]);
    expect(settled).toBe(true);
  } finally { resume?.(); }
  await vi.waitFor(async () => expect(JSON.parse(await readFile(join(directory, 'feed.json'), 'utf8')).closed).toBe(true));
});

it('retains one uncertain observer feed after ambiguous launch failure without deleting or multiplying the observer', async () => {
  let directory = '';
  const launch = vi.fn(async (folder: string) => { directory = folder; folders.push(folder); throw new Error('Synthetic ambiguous launch outcome'); });
  const observer = new AgentSessionTerminal({ read: () => snapshot(), nodeExecutable: () => process.execPath, launch, intervalMs: 10 }); observers.push(observer);
  await expect(observer.open('one')).rejects.toThrow('ambiguous');
  expect(await stat(join(directory, 'feed.json')).then(() => true, () => false)).toBe(true);
  await expect(observer.open('one')).rejects.toThrow(/Peek|confirm/u); expect(launch).toHaveBeenCalledOnce();
  await observer.dispose(); expect(await stat(directory).then(() => true, () => false)).toBe(true);
});

it('removes only owned preparation files after a definitive prelaunch failure and permits an explicit retry', async () => {
  const launch = vi.fn(async (folder: string) => { folders.push(folder); throw new SessionTerminalNotStarted('Synthetic unsupported terminal'); });
  const observer = new AgentSessionTerminal({ read: () => snapshot(), nodeExecutable: () => process.execPath, launch }); observers.push(observer);
  await expect(observer.open('one')).rejects.toThrow('unsupported');
  await expect(observer.open('one')).rejects.toThrow('unsupported'); expect(launch).toHaveBeenCalledTimes(2);
  for (const folder of folders) expect(await stat(folder).then(() => true, () => false)).toBe(false);
});
