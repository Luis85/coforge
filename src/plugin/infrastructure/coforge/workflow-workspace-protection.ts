import type { WorkflowWorkspaces } from '../../features/coforge/application/workflow-workspace-ports';
import { canonicalPotentialPath, captureProjectProtection } from './durable-worker/protection';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { agentGit } from './agent-worktree';

const inside = (parent: string, child: string) => { const path = relative(parent, child); return path === '' || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path); };
async function directoryProtection(vault: string, project: string, folders: readonly string[]) {
  const projectRoot = await realpath(resolve(project));
  const vaultRoot = await realpath(resolve(vault));
  if (!(await stat(projectRoot)).isDirectory()) throw new Error('The project directory is unavailable.');
  const protectedProjectPaths: string[] = [];
  for (const folder of folders) {
    if (!folder || !isAbsolute(folder) && folder.split(/[\\/]/u).includes('..')) throw new Error('The managed folder boundary is invalid.');
    const path = await canonicalPotentialPath(isAbsolute(folder) ? folder : resolve(vaultRoot, folder));
    if (inside(path, projectRoot)) throw new Error('The configured project is inside a managed private folder.');
    if (inside(projectRoot, path)) protectedProjectPaths.push(relative(projectRoot, path).split(sep).join('/'));
  }
  return { projectRoot, protectedProjectPaths, git: false };
}
function relativeProtection(paths: readonly string[], namespace: string): string[] {
  if (!namespace) return [...paths];
  if (paths.some(path => path === namespace || namespace.startsWith(path + '/'))) throw new Error('The requested workspace is inside a managed private folder.');
  return paths.filter(path => path.startsWith(namespace + '/')).map(path => path.slice(namespace.length + 1));
}

/** Foreground and inherited workspaces share the same canonical managed-note boundary. */
export function protectedWorkflowWorkspaces(base: WorkflowWorkspaces, vaultDirectory: () => string, folders: () => readonly string[]): WorkflowWorkspaces {
  return {
    start: () => base.start(), assertReviewable: (id, expected) => base.assertReviewable(id, expected),
    acknowledge: (id, attemptId, reusable) => base.acknowledge(id, attemptId, reusable),
    async acquire(request) {
      if (request.access === 'none') return base.acquire(request);
      const capture = async () => {
        try { return { ...await captureProjectProtection(vaultDirectory(), request.integration.projectPath, folders()), git: true }; }
        catch (error) {
          if (request.access !== 'readproject' || request.workspaceId) throw error;
          return directoryProtection(vaultDirectory(), request.integration.projectPath, folders());
        }
      };
      const initial = await capture();
      const lease = await base.acquire(request);
      let namespace = '';
      try {
        if (initial.git) {
          const top = await realpath((await agentGit(lease.cwd, ['rev-parse', '--show-toplevel'])).trim());
          if (!inside(top, lease.cwd)) throw new Error('The workspace namespace changed.');
          namespace = relative(top, lease.cwd).split(sep).join('/');
        } else if (await realpath(lease.cwd) !== initial.projectRoot) throw new Error('The read-only project namespace changed.');
        relativeProtection(initial.protectedProjectPaths, namespace);
      } catch (error) { await lease.release(true); throw error; }
      const protectedPaths = new Set([...relativeProtection(initial.protectedProjectPaths, namespace), ...(lease.protectedProjectPaths ?? [])]);
      return {
        ...lease,
        ...(request.access === 'readproject' ? { readOnly: true as const } : {}),
        get protectedProjectPaths() { return [...protectedPaths]; },
        async validate() {
          await lease.validate?.();
          const current = await capture();
          if (current.projectRoot !== initial.projectRoot) throw new Error('The captured repository authority changed.');
          for (const path of relativeProtection(current.protectedProjectPaths, namespace)) protectedPaths.add(path);
        },
      };
    },
  };
}
