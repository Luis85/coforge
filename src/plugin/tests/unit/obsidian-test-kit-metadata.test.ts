import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('../support/obsidian'));
import { getAllTags, parseYaml, stringifyYaml } from 'obsidian';
import { createTestApp, flushObsidian, parseMarkdownMetadata, splitFrontmatter } from '../support/obsidian';

const note = '---\ntitle: Plan\ntags: [work, "#urgent"]\ncustom:\n  nested: true # keep\n---\n\n# Plan\n\nLinks [[Other]], [[Other#Part|alias]] and ![[image.png]].\nTagged #todo and #2026 but `#code` is not.\n\n```md\n# not a heading [[Nope]] #nope\n```\n\n## Next ##\n';

it('parses frontmatter, headings, inline tags, wiki links and embeds with host positions', () => {
  const cache = parseMarkdownMetadata(note);
  expect(cache.frontmatter).toEqual({ title: 'Plan', tags: ['work', '#urgent'], custom: { nested: true } });
  expect(cache.frontmatterPosition).toEqual({ start: { line: 0, col: 0, offset: 0 }, end: { line: 5, col: 3, offset: note.indexOf('---', 4) + 3 } });
  expect(cache.headings?.map(item => [item.heading, item.level, item.position.start.line])).toEqual([['Plan', 1, 7], ['Next', 2, 16]]);
  expect(cache.tags?.map(item => item.tag)).toEqual(['#todo']);
  expect(cache.links?.map(item => [item.link, item.displayText, item.original])).toEqual([['Other', 'Other', '[[Other]]'], ['Other#Part', 'alias', '[[Other#Part|alias]]']]);
  expect(cache.embeds?.map(item => item.link)).toEqual(['image.png']);
  const link = cache.links?.[0]; expect(note.slice(link?.position.start.offset, link?.position.end.offset)).toBe('[[Other]]');
  expect(getAllTags(cache)).toEqual(['#work', '#urgent', '#todo']);
  expect(parseMarkdownMetadata('---\n: [broken\n---\nBody').frontmatter).toBeUndefined();
  expect(parseYaml(stringifyYaml({ a: [1, 'two'] }))).toEqual({ a: [1, 'two'] });
});

it('updates the cache asynchronously after writes and resolves links like the host', async () => {
  const kit = createTestApp({ files: { 'Plan.md': note, 'Folder/Other.md': '# Other', 'Other.md': '# Root other' } });
  const plan = kit.file('Plan.md'); const seen: string[] = [];
  kit.metadataCache.on('changed', (file: { path: string }) => seen.push(`changed:${file.path}`));
  kit.metadataCache.on('resolved', () => seen.push('resolved'));
  expect(kit.metadataCache.getFileCache(plan)?.frontmatter?.title).toBe('Plan');
  await kit.vault.modify(plan, '---\ntitle: Changed\n---\n');
  expect(kit.metadataCache.getFileCache(plan)?.frontmatter?.title).toBe('Plan');
  await flushObsidian();
  expect(kit.metadataCache.getFileCache(plan)?.frontmatter?.title).toBe('Changed'); expect(seen).toEqual(['changed:Plan.md', 'resolved']);
  expect(kit.metadataCache.getFirstLinkpathDest('Other', 'Folder/Source.md')?.path).toBe('Folder/Other.md');
  expect(kit.metadataCache.getFirstLinkpathDest('Other#Part', 'Plan.md')?.path).toBe('Other.md');
  expect(kit.metadataCache.getFirstLinkpathDest('folder/other', 'Plan.md')?.path).toBe('Folder/Other.md');
  expect(kit.metadataCache.getFirstLinkpathDest('Missing', 'Plan.md')).toBeNull();
  const deleted: unknown[] = []; kit.metadataCache.on('deleted', (_file: unknown, previous: unknown) => deleted.push(previous));
  await kit.vault.delete(plan); expect(kit.metadataCache.getCache('Plan.md')).toBeNull(); expect(deleted).toHaveLength(1);
});

it('processFrontMatter changes properties atomically and keeps the body and unrelated keys', async () => {
  const body = '\n# Body\n\nKeep *exact* bytes.\r\n';
  const kit = createTestApp({ files: { 'Task.md': `---\nstatus: todo\ncustom: [a, b]\n---\n${body}`, 'Plain.md': 'No properties\n' } });
  const task = kit.file('Task.md');
  await kit.fileManager.processFrontMatter(task, frontmatter => { frontmatter.status = 'done'; frontmatter.added = 3; });
  const text = kit.read('Task.md');
  expect(text.endsWith(`---\n${body}`)).toBe(true);
  await flushObsidian();
  expect(kit.metadataCache.getFileCache(task)?.frontmatter).toEqual({ status: 'done', custom: ['a', 'b'], added: 3 });
  await expect(kit.fileManager.processFrontMatter(task, () => { throw new Error('abort'); })).rejects.toThrow('abort');
  expect(kit.read('Task.md')).toBe(text);
  await kit.fileManager.processFrontMatter(kit.file('Plain.md'), frontmatter => { frontmatter.tag = 'x'; });
  expect(kit.read('Plain.md')).toBe('---\ntag: x\n---\nNo properties\n');
  await kit.fileManager.processFrontMatter(kit.file('Plain.md'), frontmatter => { delete frontmatter.tag; });
  expect(kit.read('Plain.md')).toBe('No properties\n');
});

it('renameFile rewrites whole wiki-link targets only and generates links', async () => {
  const kit = createTestApp({ files: { 'Old.md': '# Old', 'Older.md': '', 'Source.md': 'See [[Old]], [[Old|alias]], ![[Old#Part]] and [[Older]].' } });
  const old = kit.file('Old.md');
  await kit.fileManager.renameFile(old, 'Archive/New.md').catch((error: unknown) => error);
  await kit.vault.createFolder('Archive');
  await kit.fileManager.renameFile(old, 'Archive/New.md');
  expect(kit.read('Source.md')).toBe('See [[New]], [[New|alias]], ![[New#Part]] and [[Older]].');
  expect(kit.fileManager.generateMarkdownLink(old, 'Source.md', '#H', 'label')).toBe('[[New#H|label]]');
  await kit.fileManager.trashFile(old); expect(kit.vault.trashed.at(-1)).toMatchObject({ path: 'Archive/New.md', system: true });
});

it('makes repeated silent seeds immediately complete without changing normal metadata events', async () => {
  const kit = createTestApp({ files: { 'Source.md': '# Source\n[[Later]] ![[photo.png]]' } });
  const source = kit.file('Source.md');
  const events: string[] = [];
  for (const name of ['changed', 'resolve', 'resolved']) kit.metadataCache.on(name, () => events.push(name));
  kit.vault.seed({ 'Later.md': '---\nready: true\n---\n# Later', 'photo.png': 'bytes' });
  expect(kit.file('Source.md')).toBe(source);
  expect(kit.metadataCache.resolvedLinks['Source.md']).toEqual({ 'Later.md': 1, 'photo.png': 1 });
  expect(kit.metadataCache.unresolvedLinks['Source.md']).toEqual({});
  expect(kit.metadataCache.getFileCache(kit.file('Later.md'))?.frontmatter?.ready).toBe(true);
  kit.vault.seed({ 'Source.md': '# Replaced\n[[Unknown]]' });
  expect(kit.file('Source.md')).toBe(source);
  expect(kit.metadataCache.getFileCache(source)?.headings?.[0]?.heading).toBe('Replaced');
  expect(kit.metadataCache.resolvedLinks['Source.md']).toEqual({});
  expect(kit.metadataCache.unresolvedLinks['Source.md']).toEqual({ Unknown: 1 });
  await flushObsidian();
  expect(events).toEqual([]);
  expect(kit.errors).toEqual([]);
});

it('keeps complete CRLF frontmatter line endings for parsing and exact body offsets', () => {
  const yaml = 'title: Council\r\nenabled: true\r\nlimit: 4\r\n';
  const body = '\r\n# Human question\r\nKeep bytes.\r\n';
  const text = `---\r\n${yaml}---\r\n${body}`;
  const closing = text.indexOf('---', 3);
  expect(splitFrontmatter(text)).toEqual({ yaml, body, endLine: 4, endOffset: closing + 3 });
  expect(parseMarkdownMetadata(text).frontmatter).toEqual({ title: 'Council', enabled: true, limit: 4 });
  expect(parseMarkdownMetadata(text).headings?.[0]?.position.start.offset).toBe(text.indexOf('# Human'));
});
