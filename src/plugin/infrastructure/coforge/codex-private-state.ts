import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Isolate native thread indexes and diagnostics. The SDK retains its canonical credential store and global context. */
export async function prepareNativeCodexState(directory: string): Promise<{ sqliteHome: string; logDir: string }> {
  const home = join(directory, 'codex-home');
  await mkdir(home, { mode: 0o700 });
  const sqliteHome = join(home, 'sqlite'), logDir = join(home, 'logs');
  await mkdir(sqliteHome, { mode: 0o700 }); await mkdir(logDir, { mode: 0o700 });
  return { sqliteHome, logDir };
}
