import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { createTestApp, flushObsidian, parseMarkdownMetadata, splitFrontmatter } from '@test/obsidian';

it.each([
  { key: 'title', authored: 'Council advice', expected: 'Council advice' },
  { key: 'enabled', authored: 'true', expected: true },
  { key: 'limit', authored: '4', expected: 4 },
])('reads $key from fully CRLF notes without altering scalars or source bytes', ({ key, authored, expected }) => {
  const body = '\r\n# Council question\r\nKeep **human** bytes.\r\n';
  const yaml = `${key}: ${authored}\r\n`;
  const note = `---\r\n${yaml}---\r\n${body}`;
  const block = splitFrontmatter(note);
  expect(block?.yaml).toBe(yaml);
  expect(block?.body).toBe(body);
  const parsed = parseMarkdownMetadata(note);
  expect(parsed.frontmatter).toEqual({ [key]: expected });
  const closing = note.indexOf('---', 3);
  expect(parsed.frontmatterPosition?.end).toEqual({ line: 2, col: 3, offset: closing + 3 });
  const kit = createTestApp({ files: { 'Question.md': note } });
  expect(kit.metadataCache.getFileCache(kit.file('Question.md'))?.frontmatter).toEqual({ [key]: expected });
  expect(kit.read('Question.md')).toBe(note);
  expect(kit.errors).toEqual([]);
});

it('edits CRLF frontmatter through the kit without changing unrelated values or body bytes', async () => {
  const body = '\r\n# Council question\r\nKeep this body, including its final newline.\r\n';
  const note = `---\r\ntitle: Council advice\r\nenabled: true\r\nlimit: 4\r\n---\r\n${body}`;
  const kit = createTestApp({ files: { 'Question.md': note } });
  const file = kit.file('Question.md');
  await kit.fileManager.processFrontMatter(file, frontmatter => {
    expect(frontmatter).toEqual({ title: 'Council advice', enabled: true, limit: 4 });
    frontmatter.status = 'reviewed';
  });
  expect(splitFrontmatter(kit.read('Question.md'))?.body).toBe(body);
  await flushObsidian();
  expect(kit.metadataCache.getFileCache(file)?.frontmatter).toEqual({ title: 'Council advice', enabled: true, limit: 4, status: 'reviewed' });
  expect(kit.errors).toEqual([]);
});
