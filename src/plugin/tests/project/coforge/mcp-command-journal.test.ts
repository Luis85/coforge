import { afterEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { McpCommandJournal, type StoredMcpCommand } from '../../../infrastructure/coforge/mcp-command-journal';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    expect(dirname(root)).toBe(resolve('.nq'));
    await rm(root, { recursive: true, force: true });
  }
});
const serialized = (commands: StoredMcpCommand[]) => JSON.stringify({ version: 1, commands });
function record(id: string, output: string): StoredMcpCommand {
  return { keyHash: id.repeat(64), requestHash: 'c'.repeat(64), outcome: {
    id, projectId: 'project', taskId: 'task', runId: 'run', attemptId: 'attempt', label: 'Checks', status: 'completed',
    startedAt: '2026-11-01T00:00:00.000Z', finishedAt: '2026-11-01T00:00:01.000Z', exitCode: 0,
    output, truncated: false, source: 'host-worktree-command',
  } };
}

it.each([
  ['multibyte output', '界'.repeat(512)],
  ['JSON-escaped output', '"\\'.repeat(512)],
])('rejects oversized %s before replacing the readable ledger or its idempotency keys', async (_label, output) => {
  await mkdir('.nq', { recursive: true });
  const root = await mkdtemp(join(resolve('.nq'), 'mcp-command-journal-')); roots.push(root);
  const previous = [record('a', 'Previously observed output')];
  const next = [...previous, record('b', output)];
  const maxBytes = Buffer.byteLength(serialized(next)) - 1;
  expect(Buffer.byteLength(serialized(previous))).toBeLessThan(maxBytes);
  const journal = new McpCommandJournal(() => root, maxBytes);
  await journal.load(); await journal.save(previous);
  const path = join(root, 'mcp-command-ledger', 'commands.json');
  const before = await readFile(path);

  await expect(journal.save(next)).rejects.toMatchObject({ code: 'HOST_UNAVAILABLE' });

  expect(await readFile(path)).toEqual(before);
  expect(await readdir(dirname(path))).toEqual(['commands.json']);
  expect(await new McpCommandJournal(() => root, maxBytes).load()).toEqual(previous);
});

it.each([0, 1.5, Number.NaN, 130 * 1024 * 1024 + 1])('rejects an invalid or enlarged journal byte budget (%s)', maxBytes => {
  expect(() => new McpCommandJournal(() => 'unused', maxBytes)).toThrow();
});

it('accepts an exact byte boundary and enforces the same ceiling on reload', async () => {
  await mkdir('.nq', { recursive: true });
  const root = await mkdtemp(join(resolve('.nq'), 'mcp-command-journal-')); roots.push(root);
  const commands = [record('a', '界"\\'.repeat(100))];
  const maxBytes = Buffer.byteLength(serialized(commands));
  const journal = new McpCommandJournal(() => root, maxBytes);
  await journal.load(); await journal.save(commands);
  expect(await new McpCommandJournal(() => root, maxBytes).load()).toEqual(commands);
  await expect(new McpCommandJournal(() => root, maxBytes - 1).load()).rejects.toMatchObject({ code: 'HOST_UNAVAILABLE' });
});
