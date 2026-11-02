import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { coforgeDataPath, CoforgeDataDirectory, prepareCoforgeData } from '../../../infrastructure/coforge/vault-data-location';
import { VaultStudioStorage } from '../../../infrastructure/coforge/vault-storage';
import { atomicExistingFixture } from './atomic-command-fixture';

class TestPlugin extends Plugin {}
function fixture(files: Record<string, string> = {}) {
  const app = new App();
  const kit = createTestApp({ app, files, configDir: '.custom' });
  const plugin = new TestPlugin(app, { id: 'coforge', dir: '.custom/plugins/relocated', name: 'CoForge', version: '1', minAppVersion: '1', description: '', author: '' });
  return { kit, plugin, adapter: kit.vault.adapter };
}
const old = '.custom/plugins/relocated';
it('moves exact private bytes and backup generations out of a relocated plugin while retaining settings and notes', async () => {
  const files: Record<string, string> = {
    [`${old}/data.json`]: '{"settings":{"language":"en"}}',
    [`${old}/manifest.json`]: '{"id":"coforge"}',
    [`${old}/main.js`]: 'plugin code',
    [`${old}/styles.css`]: 'styles',
    [`${old}/coforge-state.json`]: '{ "votes": {"CF-1":["a"]} }\r\n',
    [`${old}/coforge-execution-v2.json.bak`]: 'retained journal bytes',
    [`${old}/coforge-economy-reservations/abc.json`]: 'immutable receipt',
    [`${old}/.gitignore`]: '# CoForge managed private data\ncoforge-*.json\ndata.json\n# End CoForge managed private data\n',
    'CoForge/Streams/stream-1.json': 'private stream bytes',
    'CoForge/Ideas/CF-1.md': '---\nid: CF-1\n---\nKeep my body.\r\n',
  };
  const f = fixture(files);
  await prepareCoforgeData(f.plugin);
  expect(f.kit.read('.coforge-data/studio/coforge-state.json')).toBe(files[`${old}/coforge-state.json`]);
  expect(f.kit.read('.coforge-data/council/coforge-execution-v2.json.bak')).toBe('retained journal bytes');
  expect(f.kit.read('.coforge-data/economy/reservations/abc.json')).toBe('immutable receipt');
  expect(f.kit.read('.coforge-data/streams/stream-1.json')).toBe('private stream bytes');
  for (const name of ['data.json', 'manifest.json', 'main.js', 'styles.css']) expect(f.kit.read(`${old}/${name}`)).toBe(files[`${old}/${name}`]);
  expect(f.kit.read('CoForge/Ideas/CF-1.md')).toBe(files['CoForge/Ideas/CF-1.md']);
  expect(await f.adapter.exists(`${old}/coforge-state.json`)).toBe(false);
  expect(await f.adapter.exists(`${old}/coforge-economy-reservations`)).toBe(false);
  expect(await f.adapter.exists(`${old}/.gitignore`)).toBe(false);
  expect(new VaultStudioStorage(f.plugin).dataPath).toBe('.coforge-data/studio/coforge-state.json');
  expect(f.kit.read('.coforge-data/.gitignore')).toContain('*');
});

it('preflights every destination and preserves both conflicting generations without moving other records', async () => {
  const f = fixture({ [`${old}/coforge-state.json`]: 'old', [`${old}/coforge-alerts.json`]: 'alerts', '.coforge-data/studio/coforge-state.json': 'new' });
  await expect(prepareCoforgeData(f.plugin)).rejects.toThrow('migration');
  expect(f.kit.read(`${old}/coforge-state.json`)).toBe('old');
  expect(f.kit.read('.coforge-data/studio/coforge-state.json')).toBe('new');
  expect(f.kit.read(`${old}/coforge-alerts.json`)).toBe('alerts');
});

it('resumes an interrupted migration without overwriting already moved data', async () => {
  const f = fixture({ [`${old}/coforge-state.json`]: 'state', [`${old}/coforge-alerts.json`]: 'alerts' });
  const rename = f.adapter.rename.bind(f.adapter);
  const fail = vi.spyOn(f.adapter, 'rename').mockImplementationOnce(rename).mockImplementationOnce(async () => { throw new Error('disk unavailable'); });
  await expect(prepareCoforgeData(f.plugin)).rejects.toThrow();
  fail.mockImplementation(rename);
  await prepareCoforgeData(f.plugin);
  expect(f.kit.read('.coforge-data/studio/coforge-state.json')).toBe('state');
  expect(f.kit.read('.coforge-data/alerts/coforge-alerts.json')).toBe('alerts');
  await prepareCoforgeData(f.plugin);
  expect(await f.adapter.exists(`${old}/coforge-state.json`)).toBe(false);
});

it.each(['__proto__', 'constructor', 'toString'])('rejects inherited category %s before moving any private record', async name => {
  const f = fixture({ [`${old}/coforge-${name}.json`]: 'preserve unknown data', [`${old}/coforge-state.json`]: 'state' });
  expect(() => coforgeDataPath(`coforge-${name}.json`)).toThrow('Unknown');
  await expect(prepareCoforgeData(f.plugin)).rejects.toThrow('Unknown');
  expect(f.kit.read(`${old}/coforge-${name}.json`)).toBe('preserve unknown data');
  expect(f.kit.read(`${old}/coforge-state.json`)).toBe('state');
});

it.each(['data.json\n', 'coforge-*.json*\r\n', '', '# CoForge managed private data\ncoforge-*.json\n# End CoForge managed private data\ndata.json\n'])('preserves unmarked human ignore rules byte-for-byte: %j', async human => {
  const f = fixture({ [`${old}/.gitignore`]: human, [`${old}/coforge-state.json`]: 'state' });
  await prepareCoforgeData(f.plugin);
  expect(f.kit.read(`${old}/.gitignore`)).toBe(human);
  expect(f.kit.read('.coforge-data/studio/coforge-state.json')).toBe('state');
});

it('holds an already prepared writer if an older plugin recreates its ledger', async () => {
  const f = fixture({ [`${old}/coforge-state.json`]: 'migrated' });
  const directory = new CoforgeDataDirectory(() => f.plugin);
  await directory.prepare();
  await f.adapter.write(`${old}/coforge-state.json`, 'late old-version write');
  await expect(directory.prepare()).rejects.toThrow('reappeared');
  await expect(directory.prepare()).rejects.toThrow('reappeared');
  expect(f.kit.read(`${old}/coforge-state.json`)).toBe('late old-version write');
  expect(f.kit.read('.coforge-data/studio/coforge-state.json')).toBe('migrated');
});

it('holds a prepared writer when an older recorder recreates stream history', async () => {
  const f = fixture();
  const directory = new CoforgeDataDirectory(() => f.plugin);
  await directory.prepare();
  await f.adapter.write('CoForge/Streams/late.json', 'late stream evidence');
  await expect(directory.prepare()).rejects.toThrow('reappeared');
  expect(f.kit.read('CoForge/Streams/late.json')).toBe('late stream evidence');
});

it('rejects a real studio save after a late legacy write without changing settings or note bytes', async () => {
  const f = await atomicExistingFixture();
  const legacy = `${f.app.vault.configDir}/plugins/coforge/coforge-state.json`;
  try {
    const before = f.studio.state();
    const data = f.kit.read(f.storage.dataPath), note = f.kit.read(f.file.path);
    await f.app.vault.adapter.write(legacy, 'retained late ledger');
    await expect(f.studio.updateSettings({ agentPrompt: 'Keep this change out of a forked ledger.' })).rejects.toThrow('reappeared');
    expect(f.studio.state().projects).toEqual(before.projects);
    expect(f.kit.read(f.storage.dataPath)).toBe(data);
    expect(f.kit.read(f.file.path)).toBe(note);
    expect(f.kit.read(legacy)).toBe('retained late ledger');
    await f.studio.stop();
    expect(f.kit.read(legacy)).toBe('retained late ledger');
    expect(f.kit.read(f.storage.dataPath)).toBe(data);
  } finally {
    await f.studio.stop();
  }
});
