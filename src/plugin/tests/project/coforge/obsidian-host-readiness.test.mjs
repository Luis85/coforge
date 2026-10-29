import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadPlugin } from '../../../../../tooling/testing/obsidian-plugin-control.mjs';

afterEach(() => vi.unstubAllGlobals());
describe('Contained host reload readiness', () => {
  it('waits for the real workspace layout before disabling or reloading the plugin', async () => {
    let ready; const layoutReady = new Promise(resolve => { ready = resolve; });
    const instance = { _loaded: true };
    const plugins = { manifests: { coforge: { version: '0.1.0' } }, plugins: { coforge: instance }, enabledPlugins: new Set(['coforge']),
      disablePlugin: vi.fn(async () => { instance._loaded = false; }), loadManifests: async () => {},
      enablePluginAndSave: async () => { instance._loaded = true; }, enablePlugin: async () => { instance._loaded = true; } };
    vi.stubGlobal('window', { app: { plugins, workspace: { layoutReady: false }, viewRegistry: { registerView() {} } } });
    const page = { waitForFunction: vi.fn(() => layoutReady), evaluate: async (fn, input) => fn(input) };
    const reloading = reloadPlugin(page, 'coforge');
    expect(plugins.disablePlugin).not.toHaveBeenCalled();
    window.app.workspace.layoutReady = true; ready();
    expect(await reloading).toMatchObject({ loaded: true, error: null });
    expect(page.waitForFunction).toHaveBeenCalledTimes(1);
    expect(plugins.disablePlugin).toHaveBeenCalledTimes(1);
  });
});
