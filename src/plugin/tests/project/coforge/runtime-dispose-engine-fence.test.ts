// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { createCoforgeRuntime } from '../../../infrastructure/coforge/runtime';
import { McpModule } from '../../../infrastructure/coforge/mcp-module';

it('closes the engine generation before delayed MCP shutdown and still drains already admitted canonical work', async () => {
  const app = new App(); createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const runtime = createCoforgeRuntime(plugin, () => undefined); await runtime.studio.store.init();
  let releaseMcp!: () => void; const mcpClosed = new Promise<void>(resolve => { releaseMcp = resolve; });
  const originalClose = McpModule.prototype.dispose;
  const mcp = vi.spyOn(McpModule.prototype, 'dispose').mockImplementation(function (this: McpModule) { return mcpClosed.then(() => originalClose.call(this)); });
  const stop = vi.spyOn(runtime.studio.engine, 'stop');
  let releaseWrite!: () => void; let enteredWrite!: () => void;
  const entered = new Promise<void>(resolve => { enteredWrite = resolve; });
  const writeHeld = new Promise<void>(resolve => { releaseWrite = resolve; });
  const committing = runtime.studio.store.transaction(async state => { enteredWrite(); await writeHeld; state.settings.requestCooldownSeconds = 321; });
  await entered;
  let disposed = false; const closing = runtime.dispose().then(() => { disposed = true; });
  try {
    expect(mcp).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalledTimes(1);
    await expect(runtime.studio.engine.applyPolishingResult('missing', 'missing', 0)).rejects.toThrow('no longer active');
    releaseMcp(); await Promise.resolve(); expect(disposed).toBe(false);
    releaseWrite(); await committing; await closing;
    expect(runtime.studio.state().settings.requestCooldownSeconds).toBe(321); expect(disposed).toBe(true);
  } finally { releaseMcp(); releaseWrite(); await committing; await closing; mcp.mockRestore(); stop.mockRestore(); await runtime.dispose(); }
});
