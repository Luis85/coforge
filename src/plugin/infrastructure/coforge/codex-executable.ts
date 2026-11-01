import { access } from 'node:fs/promises';
import { delimiter, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { captureProcess } from './process';
import { assignProviderFailure, providerFailureFor } from '../../features/coforge/domain/provider-failure';

/** Resolve npm's installed native binary; never execute a shell wrapper. */
export async function codexExecutable(configured = 'codex'): Promise<string> {
  const value = configured.trim() || 'codex';
  if (/\.(?:cmd|bat|ps1)$/iu.test(value)) throw assignProviderFailure(new Error('Choose native codex.exe rather than a shell wrapper.'), providerFailureFor('installation'));
  if (process.platform !== 'win32' || isAbsolute(value) || value !== 'codex') return value;
  for (const directory of (process.env.PATH ?? process.env.Path ?? '').split(delimiter).filter(Boolean)) {
    for (const path of [join(directory, 'codex.exe'), join(directory, 'node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe')]) {
      try { await access(path); return path; } catch { /* Try the next native installation. */ }
    }
  }
  return value;
}
export async function probeCodex(configured?: string): Promise<boolean> {
  try {
    const output = await captureProcess(await codexExecutable(configured), ['--version'], { cwd: tmpdir(), timeoutMs: 5000, maxBytes: 8000 });
    const match = /codex-cli (\d+)\.(\d+)\.(\d+)/u.exec(output);
    return Boolean(match && (Number(match[1]) > 0 || Number(match[2]) >= 145));
  } catch { return false; }
}
