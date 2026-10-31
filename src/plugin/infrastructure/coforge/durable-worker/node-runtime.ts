import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { shape, text, boolean } from '../../../features/coforge/domain/check';
import { childEnvironment } from '../process';
const runtimeCheck = shape({ version: text({ pattern: /^\d+\.\d+\.\d+/u }), executable: text({ min: 1, max: 4096 }), electron: boolean }, { strict: true });
export async function nativeWorkerNode(configured = 'node'): Promise<{ executable: string; version: string }> {
  if (!configured.trim() || /\.(cmd|bat|ps1)$/iu.test(configured) || /^(?:obsidian|electron)(?:\.exe)?$/iu.test(basename(configured))) throw new Error('Choose a native Node.js executable, not Electron or a shell wrapper.');
  const raw = await new Promise<string>((resolve, reject) => execFile(configured, ['-p', 'JSON.stringify({version:process.versions.node,executable:process.execPath,electron:!!process.versions.electron})'],
    { windowsHide: true, timeout: 5000, maxBuffer: 8000, env: childEnvironment() }, (error, stdout) => error ? reject(new Error('Native Node.js 22 or newer is required for background Builds.')) : resolve(stdout)));
  const checked = runtimeCheck(JSON.parse(raw));
  if (checked.electron || Number(checked.version.split('.')[0]) < 22) throw new Error('Background Builds require native Node.js 22 or newer, outside Electron.');
  return { executable: await realpath(checked.executable), version: checked.version };
}
export function workerEnvironment(): NodeJS.ProcessEnv {
  return { ...childEnvironment(), ...Object.fromEntries(Object.entries(process.env).filter(([name, value]) => ['CODEX_HOME', 'CODEX_API_KEY', 'OPENAI_API_KEY'].includes(name) && value !== undefined)) };
}
