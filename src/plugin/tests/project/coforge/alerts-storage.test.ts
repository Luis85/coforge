// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { VaultAlertsStorage } from '../../../infrastructure/coforge/alerts-storage';
import { protectPrivateData } from '../../../infrastructure/coforge/private-data-guard';
import { welcomeAlert } from './alert-test-fixture';
import { alertVaultFixture } from './alert-vault-fixture';

it('keeps exact saved definitions and stable endpoint identity across new storage instances, including private backups', async () => {
  const f = alertVaultFixture(); const storage = new VaultAlertsStorage(f.plugin);
  await protectPrivateData(f.plugin);
  const ignore = f.kit.read('.obsidian/plugins/coforge/.gitignore');
  expect(ignore).toContain('# Human rules'); expect(ignore).toContain('coforge-alerts*.json*');
  expect(await storage.load()).toEqual({ version: 1, templates: [] });
  const definition = { version: 1 as const, templates: [welcomeAlert] };
  await storage.save(definition);
  const endpoint = await storage.endpoint(); expect(endpoint.token).toMatch(/^[a-f0-9]{64}$/);
  await storage.saveEndpoint({ ...endpoint, port: 43123 });
  const reloaded = new VaultAlertsStorage(f.plugin);
  expect(await reloaded.load()).toEqual(definition);
  expect(await reloaded.endpoint()).toEqual({ port: 43123, token: endpoint.token });
  expect(f.kit.read(f.definitionsPath)).not.toContain(endpoint.token);
});

it('rejects an external definition edit without replacing the owner bytes and preserves the previous file on failed atomic replacement', async () => {
  const f = alertVaultFixture(); const storage = new VaultAlertsStorage(f.plugin); await storage.load();
  const original = { version: 1 as const, templates: [welcomeAlert] }; await storage.save(original);
  const external = JSON.stringify({ ...original, templates: [{ ...welcomeAlert, name: 'External author' }] }, null, 3) + '\n';
  await f.app.vault.adapter.write(f.definitionsPath, external);
  await expect(storage.save(original)).rejects.toThrow('changed'); expect(f.kit.read(f.definitionsPath)).toBe(external);
  await storage.load();
  const rename = f.app.vault.adapter.rename.bind(f.app.vault.adapter);
  const failure = vi.spyOn(f.app.vault.adapter, 'rename').mockImplementation(async (from, to) => {
    if (from === f.definitionsPath + '.tmp') throw new Error('Disk full');
    await rename(from, to);
  });
  try {
    await expect(storage.save(original)).rejects.toThrow('could not be replaced');
    expect(f.kit.read(f.definitionsPath)).toBe(external);
    expect(await new VaultAlertsStorage(f.plugin).load()).toEqual(JSON.parse(external));
  } finally { failure.mockRestore(); }
});

it('loads the last complete backup after a malformed definition and does not silently overwrite malformed owner data', async () => {
  const f = alertVaultFixture(); const storage = new VaultAlertsStorage(f.plugin); await storage.load();
  const first = { version: 1 as const, templates: [welcomeAlert] };
  await storage.save(first); await storage.save({ ...first, templates: [{ ...welcomeAlert, name: 'New revision' }] });
  await f.app.vault.adapter.write(f.definitionsPath, '{broken');
  const recovered = new VaultAlertsStorage(f.plugin); expect(await recovered.load()).toEqual(first);
  await expect(recovered.save(first)).rejects.toThrow(); expect(f.kit.read(f.definitionsPath)).toBe('{broken');
});
