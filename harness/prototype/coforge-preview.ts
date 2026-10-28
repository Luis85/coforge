import type { Directive } from 'vue';
import { icons } from '@iconify-json/lucide';
import { createDemoRunner } from '../../src/plugin/features/coforge/application/demo-agent.ts';
import type { InternalState, LoadedStudio, NoteIdea, StudioStorage } from '../../src/plugin/features/coforge/application/ports.ts';
import { StudioService } from '../../src/plugin/features/coforge/application/studio.ts';
import { ideaFingerprint } from '../../src/plugin/features/coforge/domain/integrity.ts';
import { noteOnly } from '../../src/plugin/features/coforge/domain/objects.ts';
import { createSeed, defaultIntegration } from '../../src/plugin/features/coforge/domain/seed.ts';
import type { CoforgeContext } from '../../src/plugin/presentation/context/coforge-context.ts';
import { previewStreamStatistics } from './stream-statistics-preview';
import { createLiveStudioPreview } from './live-studio-preview';
import type { StudioExample } from '../../src/plugin/features/coforge/application/studio-example';
import { createMusicPreview } from './music-preview';
import { createHerdrPreview } from './herdr-preview';
import { createFinancePreview } from './finance-preview';
import { PublicStreamSource } from '../../src/plugin/features/coforge/application/stream-surface-source';
import { createWorkspacePreview } from './workspace-preview';
import { createCouncilPreview } from './council-preview';

/** Browser-only storage: the sample workspace in memory, nothing is persisted. */
class PreviewStorage implements StudioStorage {
  private notes: NoteIdea[] = [];
  async load(): Promise<LoadedStudio> {
    const seed = createSeed();
    const notes = seed.ideas.map(noteOnly);
    this.notes = notes;
    return {
      notes, invalidNotes: [],
      data: {
        requestOrigins: Object.fromEntries(seed.ideas.map(idea => [idea.id, 'sample' as const])), sampleEventIds: seed.events.map(event => event.id), sampleCreatedProjectIds: seed.sampleCreatedProjectIds,
        version: 1, nextIdeaNumber: seed.nextIdeaNumber, contributors: seed.contributors, chat: seed.chat, jobs: seed.jobs, events: seed.events,
        settings: seed.settings, integration: defaultIntegration(), manualHolds: [], integrity: Object.fromEntries(seed.ideas.map(idea => [idea.id, ideaFingerprint(idea)])), ingestMeta: { processedMessages: [], lastRequests: {} },
        votes: Object.fromEntries(seed.ideas.map(idea => [idea.id, idea.voters])),
        increments: Object.fromEntries(seed.ideas.flatMap(idea => idea.increment ? [[idea.id, idea.increment] as const] : [])),
      },
    };
  }
  async save(next: InternalState): Promise<void> { this.notes = next.ideas.map(noteOnly); this.saved = next.ideas.length; }
  async previewExampleNotes(ids: readonly string[]): Promise<Record<string, string>> {
    return Object.fromEntries(ids.map(id => {
      const note = this.notes.find(item => item.id === id);
      if (!note) throw new Error('The cleanup note is missing.');
      return [id, JSON.stringify(note)];
    }));
  }
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
  let herdrExample = createHerdrPreview(studio.store);
  let financeExample = createFinancePreview(studio.store);
  const streamSource = new PublicStreamSource(studio.store);
  let costExample = createWorkspacePreview(studio.store, timers);
  let scheduleExample = createWorkspacePreview(studio.store, timers);
  let liveExample: StudioExample | undefined;
  let musicExample: ReturnType<typeof createMusicPreview> | undefined;
  let councilExample: ReturnType<typeof createCouncilPreview> | undefined;
  void studio.start().then(() => streamSource.start()).catch((error: unknown) => { failure = error instanceof Error ? error.message : String(error); });
  return {
    studio, startupError: () => failure, onNotice: () => () => undefined,
    host: {
      streamSource: streamSource.asPort(),
      previewAiCosts: () => costExample.costs(),
      previewSchedule: () => scheduleExample.schedule,
      previewFinance: () => financeExample,
      previewCouncil: () => councilExample ??= createCouncilPreview(studio.store, new URLSearchParams(window.location.search).get('council-review')),
      previewHerdr: () => herdrExample,
      previewMusic: () => musicExample ??= createMusicPreview(),
      previewLiveStudio: () => liveExample ??= createLiveStudioPreview(studio.store),
      previewStreamStatistics,
      discardPreview: (example) => {
        if (example === "finance") financeExample = createFinancePreview(studio.store);
        if (example === "ai-costs") costExample = createWorkspacePreview(studio.store, timers);
        if (example === "schedule") scheduleExample = createWorkspacePreview(studio.store, timers);
        if (example === "music") musicExample = undefined;
        if (example === "live-studio") liveExample = undefined;
        if (example === "council") councilExample = undefined;
        if (example === "herdr") herdrExample = createHerdrPreview(studio.store);
      },
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
