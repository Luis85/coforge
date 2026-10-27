// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
const { request } = vi.hoisted(() => ({ request: vi.fn(async () => ({ status: 200, headers: {}, json: {
  device_code: 'private-device', user_code: 'VISIBLE', verification_uri: 'https://www.twitch.tv/activate', expires_in: 600, interval: 5,
} })) }));
vi.mock('obsidian', async () => ({ ...await import('@test/obsidian'), requestUrl: request }));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { createCoforgeRuntime } from '../../../infrastructure/coforge/runtime';

it('passes the form encoding required by device authorization through the Obsidian HTTP adapter', async () => {
  const app = new App(); createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const runtime = createCoforgeRuntime(plugin, () => undefined);
  try {
    await runtime.start(); await runtime.studio.updateIntegration({ twitchClientId: 'client' });
    await runtime.host.twitch!.authorize('streamer');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://id.twitch.tv/oauth2/device', method: 'POST', contentType: 'application/x-www-form-urlencoded',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: expect.stringContaining('client_id=client') }));
    expect(JSON.stringify(runtime.studio.state())).not.toContain('private-device');
  } finally { await runtime.dispose(); }
});
it('keeps private project exports separate from safe diagnostic exports without filename collisions', async () => {
  const app = new App(); createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const runtime = createCoforgeRuntime(plugin, () => undefined);
  try {
    await runtime.start(); await runtime.studio.sendChat('PrivateViewer', '!register');
    const original = runtime.studio.exportJson(); const snapshot = await runtime.host.saveExport(original);
    const diagnostics = runtime.host.exportDiagnostics ? await runtime.host.exportDiagnostics() : await runtime.host.saveExport(runtime.host.diagnostics!());
    expect(await app.vault.adapter.read(snapshot)).toBe(original);
    expect(diagnostics).not.toBe(snapshot);
    const text = await app.vault.adapter.read(diagnostics); expect(text).toContain('coforge-diagnostics/v1'); expect(text).not.toContain('PrivateViewer');
    expect(await runtime.host.exportDiagnostics!()).not.toBe(diagnostics);
  } finally { await runtime.dispose(); }
});
