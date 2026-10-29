import { join, resolve } from 'node:path';
import { nativeScratch, nativeConfigDirectory, withNativeTemporaryDirectory, assertNativeVault } from './native-isolation.mjs';
import { SessionLifecycle } from './obsidian-session-lifecycle.mjs';
import { captureOutput, connectHost, freePort, stopHost, workspacePage } from './obsidian-host.mjs';
import { copyVaultTree } from '../dev/obsidian-sandbox.mjs';
import { cleanupNativeSession, stopNativeSessionHost } from './obsidian-session-cleanup.mjs';
import { assertNativeLaunchIdentity, inspectNativeClient } from './obsidian-session-identity.mjs';

export { withSession, closeOnAbort } from './obsidian-session-lifecycle.mjs';

/** Keep the tracked Electron main PID alive until its owned tree has been stopped.
 * Closing CDP first can end the main process before renderer helpers release scratch files on Windows. */
export async function closeHostClient(client, { stop = stopHost } = {}) {
  const failures = [];
  try { await stop(client.proc); } catch (error) { failures.push(error); }
  try { await client.browser.close(); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, 'OBSIDIAN_CLIENT_CLOSE_FAILED');
}

/** One real Obsidian process on a fresh copy of a synthetic vault under .nq/.
 * The plugin is installed disabled so callers can observe its whole load after attaching. */
export function createObsidianSession({ root = process.cwd(), host, chromium, vaultSource, pluginDirectory = 'dist', pluginEnabled = false,
  args = [], keepScratch = process.env.OBSIDIAN_KEEP_SCRATCH === '1', onReady = async () => undefined }) {
  root = resolve(root);
  const state = { scratch: undefined, vault: undefined, launched: undefined, configDir: undefined, output: () => '', port: 0, identity: { sourceRoot: root } };
  const session = new SessionLifecycle({
    async prepare() {
      state.scratch = await nativeScratch(root);
      state.vault = join(state.scratch, 'vault');
      await copyVaultTree(resolve(root, vaultSource), state.vault);
      state.port = await freePort();
    },
    async connect() {
      await withNativeTemporaryDirectory(state.scratch, async () => {
        state.launched = await host.launcher.launch({ appVersion: host.appVersion, installerVersion: host.installerVersion,
          vault: state.vault, copy: false, plugins: [{ path: resolve(root, pluginDirectory), enabled: pluginEnabled }],
          localStorage: { language: 'en' }, args: [`--remote-debugging-port=${state.port}`, ...args],
          spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
      }, root);
      state.output = captureOutput(state.launched.proc);
      await assertNativeVault(state.launched.vault, state.vault);
      state.configDir = await nativeConfigDirectory(state.launched.configDir, state.scratch, root);
      state.identity = { sourceRoot: root, requestedVault: state.vault, profile: state.configDir, process: assertNativeLaunchIdentity(state.launched.proc, state.configDir, root, state.port) };
      const browser = await connectHost({ chromium, port: state.port, proc: state.launched.proc, output: state.output });
      return { browser, page: undefined, vault: state.vault, port: state.port, proc: state.launched.proc, output: () => state.output() };
    },
    async initialize(client) {
      client.page = await workspacePage(client.browser);
      state.identity = await inspectNativeClient(client, { root, pluginDirectory, profile: state.configDir });
      if (state.identity.files.some(file => !file.identical)) throw new Error('OBSIDIAN_INSTALLED_ASSET_MISMATCH');
      await onReady(client);
    },
    disconnect: client => closeHostClient(client, { stop: () => stopNativeSessionHost(state, { root }) }),
    cleanup: () => cleanupNativeSession(state, { root, keepScratch }),
  });
  return Object.assign(session, { evidence: () => structuredClone({ ...state.identity, cleanup: state.cleanup }) });
}
