import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture.ts';
import { recordedStatistics } from '../../../src/plugin/tests/project/coforge/statistics-fixtures';
import { summarizeStream } from '../../../src/plugin/features/coforge/domain/stream-metrics';

describe('Stream statistics in the contained vault', () => {
  test('reads and compares canonical histories without changing their JSON bytes', async ({ obsidian }) => {
    const histories = [recordedStatistics('statistics-current', '2026-10-27T10:00:00Z'), recordedStatistics('statistics-previous', '2026-10-26T10:00:00Z')];
    const content = histories.map(history => ({ id: history.id, json: JSON.stringify(history, null, 2) }));
    await obsidian.eval(async ({ app }, input) => {
      for (const folder of ['CoForge', 'CoForge/Streams']) if (!await app.vault.adapter.exists(folder)) await app.vault.adapter.mkdir(folder);
      for (const file of input.files) await app.vault.adapter.write(`CoForge/Streams/${file.id}.json`, file.json);
      await app.vault.adapter.write('CoForge/Streams/.index.json', JSON.stringify({ activeId: null, streams: input.summaries }));
    }, { files: content, summaries: histories.map(summarizeStream) });
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'Statistics', exact: true }).click();
    await browserExpect(view.getByRole('heading', { name: 'Stream statistics', exact: true })).toBeVisible();
    await view.getByLabel('Statistics stream', { exact: true }).selectOption('statistics-current');
    await browserExpect(view.getByRole('list', { name: 'Displayed streams' }).getByRole('listitem')).toHaveCount(2);
    await browserExpect(view.getByRole('img', { name: 'Concurrent viewers over elapsed stream time', exact: true })).toBeVisible();
    await view.getByLabel('Statistics metric', { exact: true }).selectOption('cpu');
    await browserExpect(view.getByRole('img', { name: 'OBS CPU usage over elapsed stream time', exact: true })).toBeVisible();
    await obsidian.screenshot('stream-statistics-comparison');
    const after = await obsidian.eval(async ({ app }, ids) => Promise.all(ids.map(id => app.vault.adapter.read(`CoForge/Streams/${id}.json`))), content.map(file => file.id));
    expect(after).toEqual(content.map(file => file.json));
    expect(obsidian.errors()).toEqual([]);
  });
});
