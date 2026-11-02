import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { agentGit } from './agent-worktree';

/** One fresh Git process reports a coherent repository identity; results are never cached. */
export async function inspectGitWorkspace(directory: string) {
  const rows = (await agentGit(directory, ['rev-parse', '--show-toplevel', '--git-common-dir', 'HEAD', '--symbolic-full-name', 'HEAD'])).trimEnd().split(/\r?\n/u);
  const [root, common, head, reference] = rows;
  if (rows.length !== 4 || !root || !common || !head || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(head) || !reference)
    throw new Error('The retained Build workspace identity changed. Preserve it and inspect again before recovery.');
  const [canonicalRoot, canonicalCommon] = await Promise.all([realpath(root), realpath(resolve(directory, common))]);
  return { root: canonicalRoot, common: canonicalCommon, head, reference };
}
