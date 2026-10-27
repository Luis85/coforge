import { requestUrl, type App, type Plugin } from 'obsidian';
import { createDemoRunner } from '../../features/coforge/application/demo-agent';
import type { StudioHostActions, Timers } from '../../features/coforge/application/ports';
import { StudioService } from '../../features/coforge/application/studio';
import { errorMessage } from '../../features/coforge/domain/errors';
import { probeClaude, runClaudeStage } from './claude-runner';
import { syncPublicBoard } from './public-board-sync';
import { PublicSitePublisher } from './public-site-publisher';
import type { HttpRequest } from './twitch-http';
import { TwitchModule } from './twitch-module';
import { VaultStudioStorage } from './vault-storage';
import { operationsLog } from './operations-log';
import type { StructuredLogger } from '../../application/logging';

export type StudioNotice = { message: string; error: boolean };
export interface CoforgeRuntime {
  studio: StudioService; host: StudioHostActions;
  onNotice(listener: (notice: StudioNotice) => void): () => void;
  startupError(): string | null;
  start(): Promise<void>; dispose(): Promise<void>;
}

type SecretStore = { getSecret(id: string): string | null; setSecret(id: string, secret: string): void };
const secrets = (app: App): SecretStore | null => (app as App & { secretStorage?: SecretStore }).secretStorage ?? null;

const request: HttpRequest = async ({ url, method, headers, body }) => {
  const response = await requestUrl({ url, method: method ?? 'GET', headers, throw: false,
    ...(body === undefined ? {} : { body, contentType: headers['Content-Type'] ?? 'application/json' }) });
  let json: unknown = null;
  try { json = response.json; } catch { json = null; }
  return { status: response.status, json, headers: response.headers };
};

/** Composes CoForge for one plugin instance: vault storage, agent runners, Twitch intake and host actions. */
export function createCoforgeRuntime(plugin: Plugin, report: (code: string) => void, logger?: Pick<StructuredLogger, 'registerCatalog' | 'current' | 'correlation'>): CoforgeRuntime {
  const storage = new VaultStudioStorage(plugin);
  const log = operationsLog(logger);
  const listeners = new Set<(notice: StudioNotice) => void>();
  const notify = (message: string, error = false) => { for (const listener of listeners) listener({ message, error }); };
  const timers: Timers = {
    setTimeout: (callback, ms) => window.setTimeout(callback, ms), clearTimeout: handle => window.clearTimeout(handle),
    setInterval: (callback, ms) => window.setInterval(callback, ms), clearInterval: handle => window.clearInterval(handle),
  };
  const studio = new StudioService(storage, {
    runners: { demo: createDemoRunner(timers), claude: runClaudeStage }, timers, probeRuntime: probeClaude,
    report: error => { report('coforge.workflow'); notify(error.message, true); },
    events: { publish: event => log.record(event.record) }, observerFailed: () => report('coforge.observer'),
  });
  const publisher = new PublicSitePublisher(plugin);
  const twitch = new TwitchModule(studio, {
    getSecret: name => secrets(plugin.app)?.getSecret(name) ?? null,
    setSecret: (name, value) => { const store = secrets(plugin.app); if (!store) throw new Error('Obsidian secret storage is unavailable.'); store.setSecret(name, value); },
  }, request, timers, url => new WebSocket(url));
  let stopListening = () => {};
  let stopPublishing = () => {};
  let disposed = false;
  let failure: string | null = null;

  const host: StudioHostActions = {
    diagnostics: () => {
      const population = studio.state().population;
      return JSON.stringify({ schema: 'coforge-diagnostics/v1', generatedAt: new Date().toISOString(), counters: population?.counters ?? {},
        retainedOperations: population?.operations.length ?? 0, omittedOperations: population?.droppedOperations ?? 0, retainedRewards: population?.rewards.length ?? 0,
        omittedRewards: population?.droppedRewards ?? 0, logs: log.snapshot() }, null, 2);
    },
    twitch: twitch.actions,
    setSecret(name, value) {
      const store = secrets(plugin.app);
      if (!store) return false;
      store.setSecret(name, value);
      if (studio.store.ready) void twitch.reconnect();
      return true;
    },
    hasSecret: name => Boolean(secrets(plugin.app)?.getSecret(name)),
    async openIdeaNote(id) {
      const file = storage.file(id);
      if (!file) return false;
      await plugin.app.workspace.getLeaf('tab').openFile(file);
      return true;
    },
    async saveExport(json) {
      const path = `${storage.dataPath.replace(/coforge-state\.json$/, '')}coforge-export-${new Date().toISOString().slice(0, 10)}.json`;
      await plugin.app.vault.adapter.write(path, json);
      return path;
    },
    publishBoard: () => publisher.publish(studio.state(), studio.integration().publicFolder),
    async installPagesWorkflow() {
      const result = await publisher.installWorkflow(studio.integration().publicFolder);
      await publisher.publish(studio.state(), studio.integration().publicFolder);
      return result;
    },
  };

  return {
    studio, host,
    onNotice(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    startupError: () => failure,
    async start() {
      let invalidNotes: string[];
      try { ({ invalidNotes } = await studio.start()); }
      catch (error) { failure = errorMessage(error); notify(failure, true); throw error; }
      if (disposed) { await studio.stop(); return; }
      for (const path of invalidNotes) notify(`CoForge skipped an idea note with invalid properties: ${path}`, true);
      storage.watch(
        change => { void studio.applyNoteChange(change).catch(error => { report('coforge.note'); notify(errorMessage(error), true); }); },
        path => notify(`CoForge ignored an idea note with invalid or duplicate properties: ${path}`, true),
      );
      storage.watchProjects(
        change => { void studio.applyProjectNoteChange(change).catch(error => { report('coforge.note'); notify(errorMessage(error), true); }); },
        path => notify(`CoForge ignored a project note with invalid or duplicate properties: ${path}`, true),
      );
      stopListening = studio.onIntegrationChange(integration => twitch.configure(integration));
      stopPublishing = syncPublicBoard(studio, publisher, error => { report('coforge.public'); notify(`The viewer board could not be written: ${errorMessage(error)}`, true); });
      twitch.start();
    },
    async dispose() {
      disposed = true;
      stopListening(); stopPublishing(); await twitch.dispose();
      listeners.clear();
      await studio.stop();
    },
  };
}
