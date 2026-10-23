import { Notice, type Plugin } from 'obsidian';
import type { StudioHostActions } from '../../features/coforge/application/ports';
import type { StudioService } from '../../features/coforge/application/studio';
import { errorMessage } from '../../features/coforge/domain/errors';
import { STAGE_LABELS } from '../../features/coforge/domain/types';

/** Palette commands that act on the studio without opening its view. */
export function registerCoforgeCommands(plugin: Plugin, studio: StudioService, host: StudioHostActions): void {
  const run = (work: () => Promise<string>) => {
    if (!studio.store.ready) { new Notice('The studio is still loading.'); return; }
    void work().then(message => new Notice(message), (error: unknown) => new Notice(`CoForge: ${errorMessage(error)}`));
  };
  plugin.addCommand({
    id: 'run-next-step', name: 'Run the next workflow step',
    callback: () => run(async () => {
      const job = await studio.runNext();
      return job ? `CoForge: ${STAGE_LABELS[job.stage]} queued for ${job.ideaId}.` : 'CoForge: no eligible step right now.';
    }),
  });
  plugin.addCommand({
    id: 'toggle-automation', name: 'Pause or resume automation',
    callback: () => run(async () => {
      const settings = await studio.updateSettings({ paused: !studio.state().settings.paused });
      return `CoForge automation ${settings.paused ? 'paused' : 'resumed'}.`;
    }),
  });
  plugin.addCommand({
    id: 'publish-viewer-board', name: 'Publish the viewer board',
    callback: () => run(async () => {
      const result = await host.publishBoard();
      return result.changed ? `Viewer board updated in ${result.folder}. Commit and push to publish it.` : 'The viewer board is already up to date.';
    }),
  });
  plugin.addCommand({
    id: 'setup-viewer-website', name: 'Set up the viewer website',
    callback: () => run(async () => {
      const result = await host.installPagesWorkflow();
      return `Pages workflow ${result.created ? 'written' : 'up to date'} for ${result.folder}. Commit and push, then choose GitHub Actions as the Pages source.`;
    }),
  });
}
