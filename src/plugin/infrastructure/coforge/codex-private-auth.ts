import { constants } from 'node:fs';
import { lstat, mkdir, open, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MAX_AUTH_BYTES = 1024 * 1024;

/** Host-only credential transfer. Opaque auth bytes never enter model inputs, logs or configuration. */
export async function prepareNativeCodexHome(directory: string, source: NodeJS.ProcessEnv = process.env): Promise<{ CODEX_HOME: string }> {
  const home = join(directory, 'codex-home');
  await mkdir(home, { mode: 0o700 });
  if (source.CODEX_API_KEY?.trim() || source.OPENAI_API_KEY?.trim()) return { CODEX_HOME: home };
  try {
    const path = join(source.CODEX_HOME ?? join(homedir(), '.codex'), 'auth.json');
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > MAX_AUTH_BYTES) throw new Error('Unsupported credential file');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const observed = await handle.stat();
      if (!observed.isFile() || observed.nlink !== 1 || observed.size > MAX_AUTH_BYTES || observed.ino !== before.ino || observed.dev !== before.dev) throw new Error('Credential identity changed');
      const bytes = await handle.readFile();
      if (bytes.length > MAX_AUTH_BYTES) throw new Error('Credential file exceeds limit');
      await writeFile(join(home, 'auth.json'), bytes, { flag: 'wx', mode: 0o600 });
    } finally { await handle.close(); }
    return { CODEX_HOME: home };
  } catch {
    throw new Error('Codex native tools require sign-in usable in an isolated profile. Sign in through Codex with file-based authentication or configure an explicit Codex API-key environment, then retry. Keyring-only authentication cannot fall back to the global home.');
  }
}
