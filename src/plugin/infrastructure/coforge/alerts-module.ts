import type { Plugin } from 'obsidian';
import type { StudioService } from '../../features/coforge/application/studio';
import { AlertsService } from '../../features/coforge/application/alerts-service';
import { publicAlertVariables } from '../../features/coforge/application/alert-event';
import { projectIsPublic } from '../../features/coforge/domain/project-publicity';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import type { AppState } from '../../features/coforge/domain/types';
import { ALERT_EVENTS } from '../../features/coforge/domain/alerts';
import { VaultAlertsStorage } from './alerts-storage';
import { LocalAlertsServer } from './alerts-server';

export function alertsModule(plugin: Plugin, studio: StudioService) {
  const storage = new VaultAlertsStorage(plugin);
  const files = plugin.app.vault.adapter;
  const validateMedia = async (path: string) => {
    const stat = await files.stat(path);
    if (!stat || stat.type !== 'file' || stat.size > 25 * 1024 * 1024) throw new Error('An alert media file is missing or exceeds 25 MiB. Choose a smaller existing vault file.');
  };
  const server: LocalAlertsServer = new LocalAlertsServer({
    endpoint: () => storage.endpoint(), saveEndpoint: endpoint => storage.saveEndpoint(endpoint),
    mediaAllowed: path => actions.snapshot().templates.some(item => [item.image, item.audio, item.video].includes(path)),
    media: async path => { await validateMedia(path); return files.readBinary(path); },
  });
  const actions: AlertsService = new AlertsService({ load: () => storage.load(), save: async next => {
    const previous = actions.snapshot().templates;
    const changed = next.templates.filter(item => JSON.stringify(item) !== JSON.stringify(previous.find(saved => saved.id === item.id)));
    for (const path of new Set(changed.flatMap(item => [item.image, item.audio, item.video]).filter(Boolean))) await validateMedia(path);
    await storage.save(next);
  } }, server, { check: async paths => { for (const path of paths) await validateMedia(path); } });
  let unsubscribe = () => {};
  let stopPrivacy = () => {};
  let closed = false;
  const publicRequests = (state: AppState) => new Set(state.ideas.filter(item => projectIsPublic(state, ideaProjectId(item)) && item.screening?.verdict === 'clear' && ['screened', 'ranked', 'planned', 'building', 'review', 'shipped'].includes(item.status)).map(item => item.id));
  return {
    actions,
    async start() {
      await actions.start(); if (closed) return;
      unsubscribe = studio.onEvent(event => {
        if (!ALERT_EVENTS.some(type => type === event.type)) return;
        const variables = publicAlertVariables(event, studio.state());
        if (variables) return actions.event(event.type, `${event.record.sequence}:${event.record.at}`, variables);
      });
      let visible = publicRequests(studio.state());
      let denied = JSON.stringify(studio.state().runtime.publicationDeniedProjectIds ?? []);
      stopPrivacy = studio.subscribe(state => {
        const next = publicRequests(state);
        const nextDenied = JSON.stringify(state.runtime.publicationDeniedProjectIds ?? []);
        if ([...visible].some(id => !next.has(id)) || nextDenied !== denied) actions.clear();
        visible = next; denied = nextDenied;
      });
    },
    async dispose() { closed = true; unsubscribe(); stopPrivacy(); await actions.dispose(); },
  };
}
