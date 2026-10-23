import { Notice, type Plugin } from 'obsidian';
import type { StudioService } from '../../features/coforge/application/studio';
import { errorMessage } from '../../features/coforge/domain/errors';
import { STAGE_LABELS } from '../../features/coforge/domain/types';

/** Palette commands that act on the studio without opening its view. */
export function registerCoforgeCommands(plugin: Plugin, studio: StudioService): void {
  const run = (work: () => Promise<string>) => {
    if (!studio.store.ready) { new Notice('CoForge is still loading.'); return; }
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
}
