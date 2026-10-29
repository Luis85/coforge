import { rm } from 'node:fs/promises';
import { nativeConfigDirectory, nativeScratchDirectory } from './native-isolation.mjs';
import { stopHost } from './obsidian-host.mjs';
import { assertNativeLaunchIdentity } from './obsidian-session-identity.mjs';

/** Retain a failed stop across later CDP disconnect: an exited main PID is not proof its helpers closed. */
export async function stopNativeSessionHost(state, { root, stop = stopHost, validateProfile = nativeConfigDirectory, assertLaunch = assertNativeLaunchIdentity } = {}) {
  if (state.stopFailure) throw state.stopFailure;
  if (state.stopConfirmed) return { stopped: true, signal: null };
  try {
    if (state.launched?.proc?.pid) {
      const profile = await validateProfile(state.launched.configDir, state.scratch, root);
      state.processIdentity = assertLaunch(state.launched.proc, profile, root, state.port);
    }
    const result = await stop(state.launched?.proc);
    if (!result?.stopped) throw new Error('OBSIDIAN_STOP_UNCONFIRMED');
    state.stopConfirmed = true;
    return result;
  } catch (error) { state.stopFailure = error; throw error; }
}

/** Keep stop and filesystem cleanup outcomes distinct so failures remain diagnosable. */
export async function cleanupNativeSession(state, { root, keepScratch = false, stop = stopHost, validate = nativeScratchDirectory, validateProfile = nativeConfigDirectory, assertLaunch = assertNativeLaunchIdentity, remove = rm } = {}) {
  const failures = [];
  let stopped = false;
  try {
    await stopNativeSessionHost(state, { root, stop, validateProfile, assertLaunch });
    stopped = true;
  } catch (error) { failures.push(error); }
  state.cleanup = { stopped, scratchPreserved: Boolean(state.scratch && (keepScratch || !stopped)) };
  if (state.scratch && !keepScratch && stopped) {
    try { await remove(await validate(state.scratch, root), { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
    catch (error) { state.cleanup.scratchPreserved = true; failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'OBSIDIAN_SESSION_CLEANUP_FAILED');
}
