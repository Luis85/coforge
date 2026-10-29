import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { createTestApp, flushObsidian } from '@test/obsidian';

it('resolves a silent seed as one complete batch with ready metadata and forward links', async () => {
  const kit = createTestApp();
  const resolves = vi.spyOn(kit.metadataCache, 'getFirstLinkpathDest');
  const events: string[] = [];
  for (const name of ['changed', 'resolve', 'resolved']) kit.metadataCache.on(name, () => events.push(name));
  for (const name of ['create', 'modify']) kit.vault.on(name, () => events.push(name));
  const first = '---\ntitle: First\n---\n# First\r\n[[Last]] [[Missing]] ![[image.png]]\r\n';
  const fillers = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`Notes/Note-${index}.md`, '# Filler\n[[Last]]']));
  kit.vault.seed({ 'First.md': first, ...fillers, 'Last.md': '# Last', 'image.png': 'image bytes' });

  expect(resolves).toHaveBeenCalledTimes(53);
  expect(kit.metadataCache.getFileCache(kit.file('First.md'))?.frontmatter?.title).toBe('First');
  expect(kit.metadataCache.getFileCache(kit.file('Last.md'))?.headings?.[0]?.heading).toBe('Last');
  expect(kit.metadataCache.resolvedLinks['First.md']).toEqual({ 'Last.md': 1, 'image.png': 1 });
  expect(kit.metadataCache.unresolvedLinks['First.md']).toEqual({ Missing: 1 });
  expect(kit.metadataCache.resolvedLinks['Notes/Note-49.md']).toEqual({ 'Last.md': 1 });
  expect(kit.read('First.md')).toBe(first);
  await flushObsidian();
  expect(events).toEqual([]);
  expect(kit.errors).toEqual([]);
});

it('keeps ordinary metadata writes asynchronous after a seeded vault is ready', async () => {
  const kit = createTestApp({ files: { 'Source.md': '# Before\n[[Target]]', 'Target.md': '# Target' } });
  const source = kit.file('Source.md');
  const events: string[] = [];
  kit.metadataCache.on('changed', () => {
    expect(kit.metadataCache.resolvedLinks['Source.md']).toEqual({});
    expect(kit.metadataCache.unresolvedLinks['Source.md']).toEqual({ Missing: 1 });
    events.push('changed');
  });
  kit.metadataCache.on('resolve', () => events.push('resolve'));
  kit.metadataCache.on('resolved', () => events.push('resolved'));
  await kit.vault.modify(source, '# After\n[[Missing]]');
  expect(kit.metadataCache.getFileCache(source)?.headings?.[0]?.heading).toBe('Before');
  expect(kit.metadataCache.resolvedLinks['Source.md']).toEqual({ 'Target.md': 1 });
  expect(events).toEqual([]);
  await flushObsidian();
  expect(kit.metadataCache.getFileCache(source)?.headings?.[0]?.heading).toBe('After');
  expect(events).toEqual(['changed', 'resolve', 'resolved']);
  expect(kit.errors).toEqual([]);
});
