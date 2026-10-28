// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, hostInstance } from '@test/obsidian';
import { HerdrWorkflowStateStorage } from '../../../infrastructure/coforge/herdr-workflow-storage';
import type { HerdrWorkflowRecord } from '../../../features/coforge/application/herdr-workflow-ports';

function fixture() {
  const kit = createTestApp({ configDir: '.custom-host-config' });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(hostInstance(kit.app, App), { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const path = `${kit.vault.configDir}/plugins/coforge/coforge-herdr-workflow.json`;
  const record: HerdrWorkflowRecord = { id: 'attempt', jobId: 'job', ideaId: 'CF-001', projectId: 'CFP-001', stage: 'screen',
    model: 'sonnet', kind: 'claude', settings: { executable: 'herdr', session: 'default' }, fingerprint: 'fingerprint', nonce: 'nonce', at: '2026-10-28T10:00:00.000Z', phase: 'attention' };
  return { kit, plugin, path, record, storage: new HerdrWorkflowStateStorage(plugin) };
}

describe('private Herdr workflow recovery storage', () => {
  it('uses the host configuration directory and round-trips unresolved records without public vault notes', async () => {
    const f = fixture();
    expect(await f.storage.load()).toEqual([]);
    await f.storage.save([f.record]);
    expect(JSON.parse(f.kit.read(f.path))).toEqual([f.record]);
    expect(await f.storage.load()).toEqual([f.record]);
    expect(f.kit.errors).toEqual([]);
  });

  it('preserves invalid input bytes instead of replacing them with an empty journal', async () => {
    const f = fixture();
    const raw = '{private corrupt recovery evidence';
    await f.plugin.app.vault.adapter.write(f.path, raw);
    await expect(f.storage.load()).rejects.toThrow('preserved');
    expect(f.kit.read(f.path)).toBe(raw);
  });

  it('rejects duplicate attempts, incomplete completed states and oversized histories before writes', async () => {
    const f = fixture();
    await f.storage.save([f.record]);
    const original = f.kit.read(f.path);
    await expect(f.storage.save([f.record, f.record])).rejects.toThrow('could not be saved');
    await expect(f.storage.save([{ ...f.record, phase: 'completed' }])).rejects.toThrow('could not be saved');
    await expect(f.storage.save(Array.from({ length: 501 }, (_, index) => ({ ...f.record, id: `attempt-${index}` })))).rejects.toThrow('could not be saved');
    expect(f.kit.read(f.path)).toBe(original);
  });
});
