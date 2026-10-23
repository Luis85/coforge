import { requestUrl, type App, type Plugin } from 'obsidian';
import { createDemoRunner } from '../../features/coforge/application/demo-agent';
import type { StudioHostActions } from '../../features/coforge/application/ports';
import { StudioService } from '../../features/coforge/application/studio';
import { errorMessage } from '../../features/coforge/domain/errors';
import type { IntegrationSettings } from '../../features/coforge/domain/types';
import { probeClaude, runClaudeStage } from './claude-runner';
import { startTwitch, type HttpRequest } from './twitch';
import { VaultStudioStorage } from './vault-storage';

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
  const response = await requestUrl({ url, method: method ?? 'GET', headers, throw: false, ...(body === undefined ? {} : { body, contentType: 'application/json' }) });
  let json: unknown = null;
  try { json = response.json; } catch { json = null; }
  return { status: response.status, json };
};

/** Composes CoForge for one plugin instance: vault storage, agent runners, Twitch intake and host actions. */
export function createCoforgeRuntime(plugin: Plugin, report: (code: string) => void): CoforgeRuntime {
  const storage = new VaultStudioStorage(plugin);
  const listeners = new Set<(notice: StudioNotice) => void>();
  const notify = (message: string, error = false) => { for (const listener of listeners) listener({ message, error }); };
  const studio = new StudioService(storage, {
    runners: { demo: createDemoRunner(), claude: runClaudeStage }, probeRuntime: probeClaude,
    report: error => { report('coforge.workflow'); notify(error.message, true); },
  });
  let stopTwitch = () => {};
  let stopListening = () => {};
  let disposed = false;
  let failure: string | null = null;

  const connectTwitch = (integration: IntegrationSettings) => {
    stopTwitch(); stopTwitch = () => {};
    const status = (chatStatus: string, chatSource: 'simulator' | 'twitch' = 'twitch') => { void studio.store.updateRuntime({ chatSource, chatStatus }).catch(() => report('coforge.twitch')); };
    if (!integration.twitchEnabled) { status('Simulator ready', 'simulator'); return; }
    const token = secrets(plugin.app)?.getSecret(integration.twitchTokenSecret)?.trim();
    const { twitchClientId: clientId, twitchBotUserId: botUserId, twitchBroadcasterId: broadcasterId } = integration;
    if (!token || !clientId || !botUserId || !broadcasterId) { status('Twitch is enabled but not fully configured', 'simulator'); return; }
    status('Connecting to Twitch…');
    stopTwitch = startTwitch({ clientId, token, botUserId, broadcasterId }, { request, socket: url => new WebSocket(url) },
      input => studio.ingest(input), chatStatus => status(chatStatus));
  };

  const host: StudioHostActions = {
    setSecret(name, value) {
      const store = secrets(plugin.app);
      if (!store) return false;
      store.setSecret(name, value);
      if (studio.store.ready) connectTwitch(studio.integration());
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
      stopListening = studio.onIntegrationChange(connectTwitch);
      connectTwitch(studio.integration());
    },
    async dispose() {
      disposed = true;
      stopListening(); stopTwitch();
      listeners.clear();
      await studio.stop();
    },
  };
}
