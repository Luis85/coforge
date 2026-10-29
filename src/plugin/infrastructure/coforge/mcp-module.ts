import type { DataAdapter, Plugin } from 'obsidian';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { StudioService } from '../../features/coforge/application/studio';
import type { McpStepRunner } from '../../features/coforge/application/mcp-step-runner';
import type { McpActions, McpStatus } from '../../features/coforge/application/mcp-ports';
import { list, oneOf, optional, shape, text } from '../../features/coforge/domain/check';
import { LocalMcpServer } from './mcp-server';
import { McpRegistration } from './mcp-registration';
import { MCP_BRIDGE_SOURCE } from './mcp-bridge-source';
import { McpStepFiles } from './mcp-step-files';
import { McpWorkflowTools } from './mcp-workflow-tools';
import { McpVaultTools } from './mcp-vault-tools';
import { McpCoworkerTools } from './mcp-coworker-tools';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import { McpObsidianTools } from './mcp-obsidian-tools';

const entryCheck = shape({ command: text({ min: 1, max: 1000 }), args: list(text({ min: 1, max: 4096 }), { min: 2, max: 2 }) }, { strict: true });
const registrationCheck = shape({ name: text({ min: 1, max: 100 }), phase: oneOf(['pending', 'active', 'attention'] as const),
  paths: list(text({ min: 1, max: 4096 }), { min: 2, max: 2 }), entry: entryCheck }, { strict: true });
const settingsCheck = shape({ format: oneOf(['coforge-mcp/v1'] as const), registration: optional(registrationCheck),
  acknowledgedTasks: list(text({ min: 1, max: 100 }), { max: 1000 }) }, { strict: true });
type Registration = ReturnType<typeof registrationCheck>;
interface McpEnvironment { directory: string; vaultPath: string; userSettings: string; checkNode(): Promise<void> }
function localAdapter(adapter: DataAdapter): adapter is DataAdapter & { getBasePath(): string } {
  return 'getBasePath' in adapter && typeof adapter.getBasePath === 'function';
}
async function save(path: string, value: unknown): Promise<void> {
  const temporary = path + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, path);
}
async function nodeAvailable(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile('node', ['--version'], { windowsHide: true, timeout: 5000, maxBuffer: 1000 }, (error, stdout) => {
      if (error || Number(/^v(\d+)\./u.exec(stdout)?.[1] ?? 0) < 22) reject(new Error('Install Node.js 22 or newer on your PATH, restart Obsidian, then activate MCP again.'));
      else resolve();
    });
  });
}
/** One activation and exact owned registration per vault; projects are routed explicitly by tools. */
export class McpModule implements McpActions {
  private saved: Registration | undefined;
  private acknowledgedTasks: string[] = [];
  private readonly server: LocalMcpServer;
  private readonly obsidian: McpObsidianTools;
  private readonly registration = new McpRegistration();
  private token = '';
  private endpoint = '';
  private directory = '';
  private vaultPath = '';
  private vaultId = '';
  private failure = '';
  private disposed = false;
  private closing: Promise<void> | undefined;
  private ready = false;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly plugin: Plugin, private readonly studio: StudioService, private readonly runner: McpStepRunner, private readonly environment?: McpEnvironment, council?: CouncilActions, privateFolders: () => readonly string[] = () => []) {
    const authorize = () => { if (!this.status().active) throw new Error('CoForge MCP is inactive.'); };
    const workflow = new McpWorkflowTools(studio, runner, new McpStepFiles(), authorize);
    this.obsidian = new McpObsidianTools(plugin, {
      authorize,
      identity: () => {
        const adapter = plugin.app.vault.adapter;
        if (!localAdapter(adapter)) throw new Error('Obsidian CLI requires a local desktop vault.');
        const name = plugin.app.vault.getName();
        const app = plugin.app;
        const selector = 'appId' in app && typeof app.appId === 'string' && /^[a-f0-9]{16}$/iu.test(app.appId) ? app.appId : name;
        return { root: adapter.getBasePath(), selector, name };
      },
      publicFolder: () => studio.integration().publicFolder,
      blockedWriteFolders: () => ['CoForge', studio.integration().ideasFolder, ...privateFolders(),
        ...Object.values(council?.snapshot().preferences.definitionFolders ?? {}), ...(council?.snapshot().preferences.bindings.map(binding => binding.path) ?? [])],
    });
    this.server = new LocalMcpServer(new McpVaultTools(studio, workflow, authorize,
      [...(council ? [new McpCoworkerTools(studio, council, authorize)] : []), this.obsidian]));
  }
  private command<T>(work: () => Promise<T>): Promise<T> {
    const next = this.pending.then(work); this.pending = next.catch(() => undefined); return next;
  }
  private get journal() { return join(this.directory, 'coforge-mcp-settings.json'); }
  private get descriptor() { return join(this.directory, 'coforge-mcp-connection.json'); }
  private async persist(): Promise<void> { await save(this.journal, settingsCheck({ format: 'coforge-mcp/v1', registration: this.saved, acknowledgedTasks: this.acknowledgedTasks })); }
  private async publish(): Promise<void> { await save(this.descriptor, { endpoint: this.endpoint, token: this.token }); }
  private async listen(): Promise<void> { if (!this.endpoint) this.endpoint = await this.server.listen(); this.token = this.server.allow(); }
  start(): Promise<void> {
    return this.command(async () => {
      if (this.disposed) return;
      const adapter = this.plugin.app.vault.adapter;
      if (!this.environment && !localAdapter(adapter)) { this.failure = 'MCP requires desktop Obsidian with a local vault.'; return; }
      this.vaultPath = this.environment?.vaultPath ?? (localAdapter(adapter) ? adapter.getBasePath() : '');
      this.directory = this.environment?.directory ?? resolve(this.vaultPath, this.plugin.manifest.dir ?? `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`);
      this.vaultId = createHash('sha256').update(this.directory).digest('hex').slice(0, 10);
      try {
        await mkdir(this.directory, { recursive: true });
        let raw: string | undefined;
        try { raw = await readFile(this.journal, 'utf8'); } catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
        if (raw && Buffer.byteLength(raw) > 1024 * 1024) throw new Error('limit');
        const settings = settingsCheck(raw ? JSON.parse(raw) : { format: 'coforge-mcp/v1', acknowledgedTasks: [] });
        this.saved = settings.registration; this.acknowledgedTasks = settings.acknowledgedTasks;
        if (this.saved?.phase === 'active') {
          await writeFile(join(this.directory, 'coforge-mcp-bridge.cjs'), MCP_BRIDGE_SOURCE, { mode: 0o600 });
          await this.listen();
        }
        if (this.disposed) { await this.server.close(); return; }
        await this.publish(); await this.persist(); this.ready = true;
      } catch {
        await this.server.close(); this.endpoint = ''; this.token = '';
        this.failure = 'MCP settings could not be loaded. Restore the private coforge-mcp-settings.json journal before activating; incompatible or malformed configuration was preserved.';
      }
    });
  }
  status(): McpStatus {
    const active = !this.disposed && this.saved?.phase === 'active' && !!this.token;
    const recovery = this.studio.state().jobs.filter(job => job.provider === 'mcp' && ['failed', 'cancelled'].includes(job.status) && job.workflow?.workspaceId && !this.acknowledgedTasks.includes(job.id))
      .slice(-25).map(job => ({ projectId: job.projectId ?? 'CFP-001', taskId: job.id, ideaId: job.ideaId, step: job.workflow?.step.name ?? job.stage }));
    return { active, recovery, message: this.failure || (active ? 'Active for all projects in this vault. Restart or reconnect your MCP client to load the tools.' : this.saved ? 'Inactive. Inspect the MCP settings files, then deactivate to clean up or activate to retry registration.' : 'Inactive. Activate once to connect all CoForge projects in this vault.') };
  }
  /** Cleanup must preserve every selected attempt's explicit recovery route, including rows outside the UI limit. */
  assertExampleCleanup(ideaIds: readonly string[]): void {
    const selected = new Set(ideaIds);
    for (const job of this.studio.state().jobs) {
      if (job.provider !== 'mcp' || !selected.has(job.ideaId)) continue;
      if (['queued', 'running'].includes(job.status)) throw new Error('Finish or cancel the selected request’s active MCP work before cleanup.');
      if (job.workflow?.workspaceId && ['failed', 'cancelled'].includes(job.status)
        && (!this.ready || this.disposed || !this.acknowledgedTasks.includes(job.id)))
        throw new Error('Inspect and explicitly acknowledge the selected request’s MCP workspace recovery before cleanup.');
    }
  }
  activate(): Promise<void> {
    return this.command(async () => {
      if (this.disposed || !this.ready) throw new Error(this.failure || 'MCP is still loading.');
      await (this.environment?.checkNode ?? nodeAvailable)();
      const bridge = join(this.directory, 'coforge-mcp-bridge.cjs');
      await writeFile(bridge, MCP_BRIDGE_SOURCE, { mode: 0o600 });
      const userSettings = this.environment?.userSettings ?? (process.env.CLAUDE_CONFIG_DIR ? join(resolve(process.env.CLAUDE_CONFIG_DIR), '.claude.json') : join(homedir(), '.claude.json'));
      const saved: Registration = this.saved ?? { name: `coforge-${this.vaultId}`, phase: 'pending', paths: [join(this.vaultPath, '.mcp.json'), userSettings], entry: { command: 'node', args: [bridge, this.descriptor] } };
      this.saved = saved; saved.phase = 'pending'; await this.persist();
      try {
        await this.listen(); await this.publish();
        await this.registration.install(saved.paths, saved.name, saved.entry);
        saved.phase = 'active'; await this.persist();
      } catch (error) {
        this.server.revoke(); this.token = ''; saved.phase = 'attention';
        await this.publish(); await this.persist(); throw error;
      }
    });
  }
  deactivate(): Promise<void> {
    return this.command(async () => {
      if (this.disposed || !this.ready) throw new Error(this.failure || 'MCP is unavailable.');
      const saved = this.saved;
      this.server.revoke(); this.obsidian.revoke(); this.token = ''; await this.server.close(); this.endpoint = '';
      if (saved) saved.phase = 'attention'; await this.publish(); await this.persist();
      for (const job of this.studio.state().jobs.filter(item => item.provider === 'mcp' && ['queued', 'running'].includes(item.status))) await this.studio.cancel(job.id);
      if (saved) await this.registration.remove(saved.paths, saved.name, saved.entry);
      this.saved = undefined; await this.persist();
    });
  }
  recover(taskId: string): Promise<void> {
    return this.command(async () => {
      if (this.disposed || !this.ready) throw new Error('MCP recovery is unavailable.');
      const jobs = this.studio.state().jobs;
      const job = jobs.find(item => item.id === taskId && item.provider === 'mcp');
      if (!job?.workflow?.workspaceId || !['failed', 'cancelled'].includes(job.status) || jobs.some(item => item.projectId === job.projectId && ['queued', 'running'].includes(item.status)))
        throw new Error('Finish or cancel this project’s active attempts and inspect the original failed MCP workspace before recovery.');
      await this.runner.acknowledge(job.workflow.workspaceId, job.workflow.attemptId);
      const previous = this.acknowledgedTasks;
      this.acknowledgedTasks = [...new Set([...previous, taskId])].slice(-1000);
      try { await this.persist(); }
      catch (error) { this.acknowledgedTasks = previous; throw error; }
    });
  }
  dispose(): Promise<void> { return this.closing ??= this.close(); }
  private async close(): Promise<void> {
    this.disposed = true; this.obsidian.revoke(); await this.pending; await this.server.close(); await this.runner.dispose(); this.token = ''; this.endpoint = '';
    if (this.directory) await this.publish().catch(() => undefined);
  }
}
