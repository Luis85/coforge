import { afterEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { McpStepFiles } from '../../../infrastructure/coforge/mcp-step-files';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
async function fixture(coding = true) {
  await mkdir('.nq', { recursive: true }); const root = await mkdtemp(join(resolve('.nq'), 'mcp-code-files-')); roots.push(root);
  const input: StageInput = { jobId: 'task', stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: { ...defaultIntegration(), allowImplementation: true },
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'v1', proposalRevision: 'proposal', inputArtifacts: [],
      ...(coding ? { worktreeCoding: { version: 1, profile: 'mcp-worktree-v1' } } : {}),
      step: { id: 'build', kind: 'ai', name: 'Build', provider: 'claude', model: 'sonnet', access: 'editworktree', output: 'codechange', automatic: false, instructions: 'Build' } } };
  const files = new McpStepFiles();
  const task = { input, lease: { id: 'workspace', cwd: root, validate: async () => {}, capture: async () => undefined, release: async () => {} } };
  return { root, call: (name: string, raw: unknown) => files.call(name, task, raw) };
}
it('allows authorized coding dependency edits and atomic literal patches with exact SHA preconditions', async () => {
  const f = await fixture(); const before = '{"name":"before"}\n';
  await writeFile(join(f.root, 'package.json'), before);
  expect(await f.call('coforge_apply_patch', { path: 'package.json', expectedSha256: hash(before), edits: [{ oldText: 'before', newText: 'after' }] })).toMatchObject({ path: 'package.json', written: true });
  expect(await readFile(join(f.root, 'package.json'), 'utf8')).toBe('{"name":"after"}\n');
  await expect(f.call('coforge_apply_patch', { path: 'package.json', expectedSha256: hash(before), edits: [{ oldText: 'after', newText: 'lost' }] })).rejects.toThrow();
  expect(await readFile(join(f.root, 'package.json'), 'utf8')).toBe('{"name":"after"}\n');
  const legacy = await fixture(false); await writeFile(join(legacy.root, 'package.json'), before);
  await expect(legacy.call('coforge_write_file', { path: 'package.json', expectedContent: before, content: 'new' })).rejects.toThrow();
});
it('moves a verified file without replacing another destination and never grants protected paths', async () => {
  const f = await fixture(); await writeFile(join(f.root, 'old.ts'), 'source'); await writeFile(join(f.root, 'taken.ts'), 'human');
  await expect(f.call('coforge_move_file', { path: 'old.ts', destination: 'taken.ts', expectedSha256: hash('source') })).rejects.toThrow();
  expect(await readFile(join(f.root, 'taken.ts'), 'utf8')).toBe('human');
  expect(await f.call('coforge_move_file', { path: 'old.ts', destination: 'nested/new.ts', expectedSha256: hash('source') })).toMatchObject({ moved: true });
  await expect(readFile(join(f.root, 'old.ts'))).rejects.toThrow();
  expect(await readFile(join(f.root, 'nested/new.ts'), 'utf8')).toBe('source');
  await expect(f.call('coforge_apply_patch', { path: '.env', expectedSha256: hash(''), edits: [{ oldText: 'a', newText: 'b' }] })).rejects.toThrow();
});
it('returns a generated image as a bounded image artifact and excludes private content', async () => {
  const f = await fixture(); const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxZsAAAAASUVORK5CYII=', 'base64');
  await writeFile(join(f.root, 'proof.png'), png);
  expect(await f.call('coforge_read_artifact', { path: 'proof.png' })).toMatchObject({ kind: 'image', mimeType: 'image/png', data: png.toString('base64') });
  await writeFile(join(f.root, '.env'), 'PRIVATE_TOKEN');
  await expect(f.call('coforge_read_artifact', { path: '.env' })).rejects.toThrow();
});

// Real 3×2 RGB images encoded with libwebp (Pillow); no decoder dependency at runtime.
const webpLossy = 'UklGRjgAAABXRUJQVlA4ICwAAADQAQCdASoDAAIAAUAmJaACdLoB+AADsAD+8Gyv/ziWOp3d2f/xZyMR2XgAAA==';
const webpLossless = 'UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAdQsKqUtf+BiOh/AAA=';
const webpExtended = 'UklGRloAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAgICAgICAAFZQOCAsAAAA0AEAnQEqAwACAAFAJiWgAnS6AfgAA7AA/vBsr/84ljqd3dn/8WcjEdl4AAA=';
it.each([['VP8 ', webpLossy], ['VP8L', webpLossless], ['VP8X', webpExtended]])('returns an actual %s WebP as image content with dimensions and an exact digest', async (chunk, encoded) => {
  const f = await fixture(), data = Buffer.from(encoded, 'base64');
  expect(data.toString('ascii', 12, 16)).toBe(chunk);
  await writeFile(join(f.root, 'proof.webp'), data);
  expect(await f.call('coforge_read_artifact', { path: 'proof.webp' })).toMatchObject({
    kind: 'image', mimeType: 'image/webp', width: 3, height: 2, data: encoded,
    sha256: createHash('sha256').update(data).digest('hex'),
  });
});

it.each([
  ['truncated lossy header', webpLossy, (data: Buffer) => data.subarray(0, 29)],
  ['truncated lossless header', webpLossless, (data: Buffer) => data.subarray(0, 24)],
  ['missing lossy keyframe signature', webpLossy, (data: Buffer) => { data[23] = 0; return data; }],
  ['interframe instead of a keyframe', webpLossy, (data: Buffer) => { data[20] = data[20]! | 1; return data; }],
  ['missing lossless signature', webpLossless, (data: Buffer) => { data[20] = 0; return data; }],
  ['unsupported lossless version', webpLossless, (data: Buffer) => { data[24] = data[24]! | 32; return data; }],
  ['chunk outside RIFF boundary', webpLossy, (data: Buffer) => { data.writeUInt32LE(0xffffffff, 16); return data; }],
  ['RIFF outside file boundary', webpLossless, (data: Buffer) => { data.writeUInt32LE(data.length + 100, 4); return data; }],
  ['RIFF smaller than first chunk', webpLossy, (data: Buffer) => { data.writeUInt32LE(12, 4); return data; }],
  ['truncated extended header', webpExtended, (data: Buffer) => data.subarray(0, 29)],
  ['reserved extended flags', webpExtended, (data: Buffer) => { data[20] = data[20]! | 1; return data; }],
  ['nonzero odd-chunk padding', webpLossless, (data: Buffer) => { data[data.length - 1] = 1; return data; }],
  ['zero lossy width', webpLossy, (data: Buffer) => { data.writeUInt16LE(0, 26); return data; }],
  ['lossy pixel limit', webpLossy, (data: Buffer) => { data.writeUInt16LE(16383, 26); data.writeUInt16LE(16383, 28); return data; }],
  ['lossless pixel limit', webpLossless, (data: Buffer) => { data.writeUInt32LE(0x0fffffff, 21); return data; }],
])('rejects malformed or oversized WebP: %s', async (_label, encoded, mutate) => {
  const f = await fixture(); await writeFile(join(f.root, 'bad.webp'), mutate(Buffer.from(encoded, 'base64')));
  await expect(f.call('coforge_read_artifact', { path: 'bad.webp' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
});

it('retains the artifact byte limit and protected-path boundary for valid WebP content', async () => {
  const f = await fixture(), image = Buffer.from(webpLossy, 'base64');
  await writeFile(join(f.root, '.env'), image);
  await expect(f.call('coforge_read_artifact', { path: '.env' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  const oversized = Buffer.alloc(2 * 1024 * 1024 + 1); image.copy(oversized);
  await writeFile(join(f.root, 'oversized.webp'), oversized);
  await expect(f.call('coforge_read_artifact', { path: 'oversized.webp' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
});
