import type { Plugin } from 'obsidian';
import { randomBytes } from 'node:crypto';
import { alertsDefinitionCheck, type AlertsDefinition } from '../../features/coforge/domain/alerts';
import { number, shape, text } from '../../features/coforge/domain/check';
import type { AlertsStorage } from '../../features/coforge/application/alerts-ports';
import { readJson, writeJson } from './atomic-json';
import type { AlertEndpoint } from './alerts-server';
import { COFORGE_DATA, CoforgeDataDirectory } from './vault-data-location';

export class VaultAlertsStorage implements AlertsStorage {
  private readonly dataDirectory = new CoforgeDataDirectory(() => this.plugin);
  private identity: string | undefined;
  private readonly folder: string;
  constructor(private readonly plugin: Plugin) { this.folder = `${COFORGE_DATA}/alerts`; }
  private get path(): string { return `${this.folder}/coforge-alerts.json`; }
  async load(): Promise<AlertsDefinition> {
    await this.dataDirectory.prepare();
    const state = await readJson(this.plugin.app.vault.adapter, this.path, alertsDefinitionCheck) ?? { version: 1, templates: [] };
    this.identity = JSON.stringify(state); return state;
  }
  async save(next: AlertsDefinition): Promise<void> {
    await this.dataDirectory.prepare();
    const current = await readJson(this.plugin.app.vault.adapter, this.path, alertsDefinitionCheck) ?? { version: 1, templates: [] };
    if (this.identity === undefined || JSON.stringify(current) !== this.identity) throw new Error('Alerts changed outside this editor. Reload CoForge before saving; your draft is retained.');
    await writeJson(this.plugin.app.vault.adapter, this.path, next, alertsDefinitionCheck); this.identity = JSON.stringify(next);
  }
  async endpoint(): Promise<AlertEndpoint> {
    await this.dataDirectory.prepare();
    return await readJson(this.plugin.app.vault.adapter, `${this.folder}/coforge-alerts-endpoint.json`, endpointCheck) ?? { port: 0, token: randomBytes(32).toString('hex') };
  }
  async saveEndpoint(endpoint: AlertEndpoint): Promise<void> { await this.dataDirectory.prepare(); await writeJson(this.plugin.app.vault.adapter, `${this.folder}/coforge-alerts-endpoint.json`, endpoint, endpointCheck); }
}
const endpointCheck = shape({ port: number({ min: 1, max: 65535, integer: true }), token: text({ pattern: /^[a-f0-9]{64}$/ }) }, { strict: true });
