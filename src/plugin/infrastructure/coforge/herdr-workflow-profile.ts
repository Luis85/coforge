import { lstat, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import type { HerdrWorkflowProfile } from '../../features/coforge/application/herdr-workflow-ports';

const DENIED = [
  'mcp__*', 'Bash', 'PowerShell', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Agent',
  ...['**/.env*', '**/*.pem', '**/*.key', '**/.git', '**/.git/**', '**/.claude/**']
    .flatMap((path) => [`Read(${path})`, `Edit(${path})`]),
  'Edit(**/package.json)', 'Edit(**/*lock*)',
];
const invalid = () => new Error('The managed Herdr launch profile or its private result location is invalid.');

export async function canonicalHerdrDirectory(path: string): Promise<string> {
  if (!isAbsolute(path) || /\p{Cc}/u.test(path)) throw invalid();
  try {
    const actual = await realpath(path);
    if (!(await stat(actual)).isDirectory()) throw invalid();
    return actual;
  } catch { throw invalid(); }
}

export async function sameHerdrDirectory(left: string, right: string): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([canonicalHerdrDirectory(left), canonicalHerdrDirectory(right)]);
    return process.platform === 'win32' ? normalize(a).toLowerCase() === normalize(b).toLowerCase() : a === b;
  } catch { return false; }
}

/** Claude permission rules use Edit(path) for Write too; never use a non-matching Write(path) rule. */
function exactEditRule(path: string): string {
  if (/[(),*?[\]{}]/u.test(path) || /\p{Cc}/u.test(path)) throw invalid();
  const slashes = path.replaceAll('\\', '/').replace(/^([a-zA-Z]):\//u, (_match, drive: string) => `/${drive.toLowerCase()}/`);
  return `Edit(/${slashes})`;
}

/** Interactive flags only: Herdr does not enforce the native print runner's turn or spending caps. */
export async function buildHerdrWorkflowArgs(cwd: string, profile: HerdrWorkflowProfile): Promise<string[]> {
  if (profile.kind !== 'claude' || !/^[a-z][a-z0-9_-]{0,31}$/u.test(profile.name) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+[\]-]{0,199}$/u.test(profile.model) ||
      (profile.sessionId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(profile.sessionId)) ||
      !['screen', 'score', 'plan', 'implement'].includes(profile.stage) || !isAbsolute(profile.resultPath)) throw invalid();
  const systemPrompt = profile.systemPrompt.replace(/\s+/gu, ' ').trim();
  if (!systemPrompt || systemPrompt.length > 20000 || /\p{Cc}/u.test(systemPrompt)) throw invalid();
  const [root, artifactParent] = await Promise.all([
    canonicalHerdrDirectory(cwd), canonicalHerdrDirectory(dirname(profile.resultPath)),
  ]);
  const artifact = resolve(artifactParent, basename(profile.resultPath));
  const location = relative(root, artifact);
  const inside = !!location && location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location);
  if (inside === (profile.stage === 'plan')) throw invalid();
  try { if ((await lstat(artifact)).isSymbolicLink()) throw invalid(); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw invalid(); }
  const writeResult = exactEditRule(artifact);
  const classification = profile.stage === 'screen' || profile.stage === 'score';
  const tools = classification ? 'Write' : profile.stage === 'plan' ? 'Read,Glob,Grep,Write' : 'Read,Glob,Grep,Edit,Write';
  const allowed = classification ? writeResult : profile.stage === 'plan' ? `Read,Glob,Grep,${writeResult}` : tools;
  return [
    '--restricted', '--safe-mode', '--no-chrome', '--setting-sources', '',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--tools', tools, '--allowedTools', allowed, '--disallowedTools', DENIED.join(','),
    '--permission-mode', 'dontAsk', ...(profile.stage === 'plan' ? ['--add-dir', artifactParent] : []),
    '--model', profile.model, ...(profile.sessionId ? ['--session-id', profile.sessionId] : []), '--system-prompt', systemPrompt,
  ];
}
