import type { Plugin } from 'obsidian';
import type { HerdrWorkflowRecord, HerdrWorkflowStorage } from '../../features/coforge/application/herdr-workflow-ports';
import { boolean, list, number, oneOf, optional, shape, text, timestamp } from '../../features/coforge/domain/check';

const string = text({ max: 4096 });
const identity = text({ min: 1, max: 320 });
const sequence = optional(number({ min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }));
const target = shape({
  paneId: identity, terminalId: identity, workspaceId: identity, agent: string, name: string, cwd: string,
  status: string, ready: boolean, sessionRef: string, stateChangeSeq: sequence, completionSeq: sequence,
}, { strict: true });
const settings = shape({ executable: text({ min: 1, max: 1000 }), session: text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9_-]+$/u }) }, { strict: true });
const recordCheck = shape({
  id: identity, jobId: identity, ideaId: identity, projectId: identity, stage: oneOf(['screen', 'score', 'plan', 'implement'] as const),
  model: text({ min: 1, max: 100 }), kind: oneOf(['claude'] as const), settings,
  fingerprint: identity, nonce: identity, at: timestamp, updatedAt: optional(timestamp), inspectedAt: optional(timestamp),
  inspection: optional(oneOf(['session', 'original-target', 'target-changed'] as const)),
  phase: oneOf(['preparing', 'creating-workspace', 'workspace-created', 'starting-agent', 'agent-ready', 'sending-prompt', 'waiting-result', 'completed', 'attention', 'reviewed'] as const),
  projectPath: optional(string), worktreeFolder: optional(string), cwd: optional(string), resultPath: optional(string),
  workspace: optional(shape({ id: identity, name: string, cwd: string }, { strict: true })),
  pane: optional(shape({ id: identity, terminalId: identity, workspaceId: identity, cwd: string, agent: string }, { strict: true })),
  target: optional(target),
  configuration: optional(shape({ systemPrompt: text({ min: 1, max: 20000 }), timeoutSeconds: number({ integer: true, min: 15, max: 1800 }), sessionId: identity }, { strict: true })),
  launchArgv: optional(list(text({ max: 20000 }), { max: 100 })),
}, { strict: true });
const recordsCheck = list(recordCheck, { max: 500 });
const MAX_BYTES = 32 * 1024 * 1024;
function validate(value: unknown): HerdrWorkflowRecord[] {
  const records = recordsCheck(value);
  if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('duplicate');
  for (const record of records) {
    if (['workspace-created', 'starting-agent', 'agent-ready', 'sending-prompt', 'waiting-result', 'completed'].includes(record.phase) &&
        (!record.cwd || !record.resultPath || !record.configuration || !record.workspace || !record.pane)) throw new Error('incomplete');
    if (['agent-ready', 'sending-prompt', 'waiting-result', 'completed'].includes(record.phase) && (!record.target || !record.launchArgv)) throw new Error('incomplete');
    if (record.workspace && record.pane && record.workspace.id !== record.pane.workspaceId) throw new Error('identity');
    if (record.target && record.pane && (record.target.workspaceId !== record.pane.workspaceId || record.target.terminalId !== record.pane.terminalId || record.target.paneId !== record.pane.id)) throw new Error('identity');
    if (record.configuration && record.configuration.sessionId !== record.jobId) throw new Error('session');
  }
  return records;
}

/** Private recovery evidence. Never replaces unreadable data with an empty successful load. */
export class HerdrWorkflowStateStorage implements HerdrWorkflowStorage {
  constructor(private readonly plugin: Plugin) {}
  private get path(): string {
    const { app, manifest } = this.plugin;
    return `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-herdr-workflow.json`;
  }
  async load(): Promise<HerdrWorkflowRecord[]> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      if (!(await adapter.exists(this.path))) return [];
      const info = await adapter.stat(this.path);
      if (!info || info.type !== 'file' || info.size > MAX_BYTES) throw new Error('limit');
      const raw = await adapter.read(this.path);
      if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('limit');
      return validate(JSON.parse(raw));
    } catch {
      throw new Error('The private Herdr workflow journal could not be read. Its stored file was preserved; restore it before dispatching.');
    }
  }
  async save(records: HerdrWorkflowRecord[]): Promise<void> {
    try {
      const checked = validate(records);
      const raw = JSON.stringify(checked, null, 2);
      if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('limit');
      await this.plugin.app.vault.adapter.write(this.path, raw);
    } catch {
      throw new Error('The private Herdr workflow journal could not be saved. No further Herdr mutations are allowed until recovery is restored.');
    }
  }
}
