// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { alertsModule } from '../../../infrastructure/coforge/alerts-module';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed } from '../../../features/coforge/domain/seed';
import { recordOperation } from '../../../features/coforge/application/population';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { alertVaultFixture } from './alert-vault-fixture';
import { alertHttp, alertImageUrl, alertStream } from './alert-http-fixture';
import { welcomeAlert } from './alert-test-fixture';

async function fixture() {
  const f = alertVaultFixture(); const storage = new MemoryStorage(createSeed());
  const studio = new StudioService(storage, { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); const module = alertsModule(f.plugin, studio); await module.start();
  await module.actions.save(welcomeAlert);
  await module.actions.save({ ...welcomeAlert, id: 'marker', name: 'Manual marker', text: '{{marker}}', event: '', enabled: false });
  const source = await alertStream(module.actions.snapshot().url);
  await expect.poll(() => module.actions.snapshot().sources).toBe(1);
  return { ...f, studio, storage, module, source,
    async marker(value: string) { await module.actions.fire('marker', { marker: value }); expect(await source.event('cue')).toContain(value); },
    async dispose() { await source.close(); await module.dispose(); await studio.stop(); },
  };
}

it('ALERTS-07 carries actual committed Twitch registration to the browser once and skips failed, duplicate and simulated intake', async () => {
  const f = await fixture();
  try {
    const viewer = { username: 'Alert viewer', userId: 'alert-viewer', source: 'twitch' as const, text: '!register', messageId: 'registration-one' };
    await f.studio.ingest(viewer); expect(await f.source.event('cue')).toContain('Welcome Alert viewer! 1');
    await f.studio.ingest(viewer);
    await f.studio.sendChat('Local test', '!register');
    f.storage.failNextSave = true;
    await expect(f.studio.ingest({ ...viewer, userId: 'failed-viewer', messageId: 'failed-registration' })).rejects.toThrow();
    await f.marker('No replay or uncommitted alert');
  } finally { await f.dispose(); }
});

it('projects only public request variables and clears already shown request content when privacy is revoked', async () => {
  const f = await fixture();
  try {
    const idea = f.studio.state().ideas.find(item => item.status === 'screened' && item.screening?.verdict === 'clear');
    if (!idea) throw new Error('Missing screened fixture');
    await f.module.actions.save({ ...welcomeAlert, id: 'vote', name: 'Public vote', text: '{{request}} {{title}}', event: 'vote-counted', enabled: true });
    const viewer = { username: 'Public voter', userId: 'public-alert-voter', source: 'twitch' as const };
    await f.studio.ingest({ ...viewer, text: '!register', messageId: 'public-vote-registration' });
    expect(await f.source.event('cue')).toContain('Welcome Public voter! 1');
    await f.studio.ingest({ ...viewer, text: `!vote ${idea.id}`, messageId: 'public-vote' });
    const cue = await f.source.event('cue'); expect(cue).toContain(idea.title); expect(cue).not.toContain('projectPath');
    const projectId = idea.projectId ?? 'CFP-001';
    await f.studio.store.transaction(state => { const project = state.projects.find(item => item.id === projectId); if (!project) throw new Error('Missing parent project'); project.visibility = 'private'; });
    expect(await f.source.event('clear')).toBe('{}');
    await f.studio.store.transaction(state => { recordOperation(state, 'vote-counted', 'committed', undefined, 1, idea.id); });
    await f.marker('Private vote skipped');
  } finally { await f.dispose(); }
});

it('checks selected media again at dispatch and removes its public route after deleting the template', async () => {
  const f = await fixture();
  try {
    // The in-memory kit stores text; the real-host spec verifies actual binary GIF/WAV decoding.
    await f.app.vault.adapter.write('Alerts/party.gif', 'GIF');
    Object.assign(f.app.vault.adapter, { readBinary: async (path: string) => new TextEncoder().encode(f.kit.read(path)).buffer });
    await f.module.actions.save({ ...welcomeAlert, id: 'media', name: 'Media', text: '', image: 'Alerts/party.gif', event: '', enabled: false });
    await f.module.actions.fire('media', {});
    const frame = await f.source.event('cue');
    expect(frame).not.toContain('Alerts/'); expect(frame).not.toContain('party.gif');
    const path = alertImageUrl(frame, f.module.actions.snapshot().url);
    expect((await alertHttp(path)).status).toBe(200);
    await f.app.vault.adapter.remove('Alerts/party.gif');
    await expect(f.module.actions.fire('media', {})).rejects.toThrow();
    await f.marker('Missing media did not dispatch');
    await f.module.actions.remove('media'); expect(await f.source.event('clear')).toBe('{}');
    expect((await alertHttp(path)).status).toBe(404);
  } finally { await f.dispose(); }
});
