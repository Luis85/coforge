import type { Directive } from 'vue';
import { icons } from '@iconify-json/lucide';
import { createDemoRunner } from '../../src/plugin/features/coforge/application/demo-agent.ts';
import type { InternalState, LoadedStudio, StudioStorage } from '../../src/plugin/features/coforge/application/ports.ts';
import { StudioService } from '../../src/plugin/features/coforge/application/studio.ts';
import { ideaFingerprint } from '../../src/plugin/features/coforge/domain/integrity.ts';
import { noteOnly } from '../../src/plugin/features/coforge/domain/objects.ts';
import { createSeed, defaultIntegration } from '../../src/plugin/features/coforge/domain/seed.ts';
import type { CoforgeContext } from '../../src/plugin/presentation/context/coforge-context.ts';
import { previewStreamStatistics } from './stream-statistics-preview';

/** Browser-only storage: the sample workspace in memory, nothing is persisted. */
class PreviewStorage implements StudioStorage {
  async load(): Promise<LoadedStudio> {
    const seed = createSeed();
    const notes = seed.ideas.map(noteOnly);
    return {
      notes, invalidNotes: [],
      data: {
        version: 1, nextIdeaNumber: seed.nextIdeaNumber, contributors: seed.contributors, chat: seed.chat, jobs: seed.jobs, events: seed.events,
        settings: seed.settings, integration: defaultIntegration(), manualHolds: [], integrity: Object.fromEntries(seed.ideas.map(idea => [idea.id, ideaFingerprint(idea)])), ingestMeta: { processedMessages: [], lastRequests: {} },
        votes: Object.fromEntries(seed.ideas.map(idea => [idea.id, idea.voters])),
        increments: Object.fromEntries(seed.ideas.flatMap(idea => idea.increment ? [[idea.id, idea.increment] as const] : [])),
      },
    };
  }
  async save(next: InternalState): Promise<void> { this.saved = next.ideas.length; }
  /** Idea count of the last save (nothing is persisted in the browser preview). */
  saved = 0;
}

/** One shared demo studio for every preview frame, started with the sample workspace. */
export function createPreviewCoforge(): CoforgeContext {
  const timers = {
    setTimeout: (callback: () => void, ms: number) => window.setTimeout(callback, ms), clearTimeout: (handle: number) => window.clearTimeout(handle),
    setInterval: (callback: () => void, ms: number) => window.setInterval(callback, ms), clearInterval: (handle: number) => window.clearInterval(handle),
  };
  const runner = createDemoRunner(timers);
  const studio = new StudioService(new PreviewStorage(), {
    timers,
    runners: { demo: runner, claude: () => Promise.reject(new Error('Claude Code is not available in the browser preview.')) },
    probeRuntime: () => Promise.resolve({ cliAvailable: false, projectPath: null, allowImplementation: false }),
  });
  let failure: string | null = null;
  void studio.start().catch((error: unknown) => { failure = error instanceof Error ? error.message : String(error); });
  return {
    studio, startupError: () => failure, onNotice: () => () => undefined,
    host: {
      previewStreamStatistics,
      setSecret: () => false, hasSecret: () => false,
      openIdeaNote: () => Promise.resolve(false), saveExport: () => Promise.resolve('the browser preview (not saved)'),
      publishBoard: () => Promise.reject(new Error('Publishing needs the Obsidian desktop app.')),
      installPagesWorkflow: () => Promise.reject(new Error('Publishing needs the Obsidian desktop app.')),
    },
  };
}

/** Renders Lucide icons from the locally installed icon set, like Obsidian's setIcon in the plugin. */
export const previewIconDirective: Directive<HTMLElement, string> = {
  mounted(element, binding) { render(element, binding.value); },
  updated(element, binding) { if (binding.value !== binding.oldValue) render(element, binding.value); },
};
function render(element: HTMLElement, name: string): void {
  const body = icons.icons[name]?.body ?? icons.icons[icons.aliases?.[name]?.parent ?? '']?.body;
  element.replaceChildren();
  if (!body) return;
  const svg = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`, 'image/svg+xml').documentElement;
  element.append(element.ownerDocument.importNode(svg, true));
}
