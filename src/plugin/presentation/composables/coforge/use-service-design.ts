import { computed, nextTick, onMounted, reactive, ref, type ComponentPublicInstance } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { blueprintDraft, useServiceDesignStore } from '../../stores/service-design';
import {
  BLUEPRINT_KINDS, BLUEPRINT_LABELS, BLUEPRINT_LAYERS,
  type BlueprintInput, type BlueprintKind, type BlueprintNote,
} from '../../../features/service-design/domain/blueprint';

/** Per-project drafts survive navigation; async saves retain their captured project. */
export function useServiceDesign() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const store = useServiceDesignStore();
  const titleInput = ref<HTMLInputElement | null>(null);
  const replacement = ref<HTMLElement | null>(null);
  const projectId = computed(() => studio.activeProject?.id ?? '');
  const session = computed(() => store.session(projectId.value));
  const notes = computed(() => store.catalogue.notes.filter(note => note.projectId === projectId.value));
  const blueprint = computed(() => notes.value.find(note => note.kind === 'blueprint'));
  const steps = computed(() => notes.value.filter(note => note.kind === 'journey-step'));
  const totalEntities = computed(() => notes.value.filter(note => note.kind !== 'blueprint' && note.kind !== 'journey-step').length);
  const grid = computed(() => {
    const cells = new Map<string, BlueprintNote[]>();
    for (const note of notes.value) {
      const key = `${note.kind}:${note.stepId}`;
      const items = cells.get(key) ?? [];
      items.push(note); cells.set(key, items);
    }
    return cells;
  });
  const dirty = computed(() => Boolean(session.value.draft && JSON.stringify(session.value.draft) !== session.value.baseline));
  async function run(work: () => Promise<void>) {
    if (store.busy) return;
    store.busy = true; store.error = ''; store.notice = '';
    try { await work(); }
    catch (error) { store.error = error instanceof Error ? error.message : 'Service Design could not be updated. Refresh and try again.'; }
    finally { store.busy = false; }
  }
  async function load() {
    if (!host.serviceDesign) return;
    const previous = store.catalogue.folder;
    store.catalogue = await host.serviceDesign.load();
    if (!store.loaded || store.folder === previous) store.folder = store.catalogue.folder;
    store.loaded = true;
  }
  onMounted(() => { void run(load); });
  function select(draft: BlueprintInput) {
    if (store.busy) return;
    const target = { ...draft, links: [...draft.links] };
    if (dirty.value) {
      session.value.pending = target;
      void nextTick(() => replacement.value?.focus());
    }
    else {
      session.value.draft = target; session.value.baseline = JSON.stringify(target);
      void nextTick(() => titleInput.value?.focus());
    }
  }
  function begin(kind: BlueprintKind, stepId = '') {
    const draft = blueprintDraft(kind, stepId);
    if (kind === 'journey-step') draft.order = Math.max(0, ...steps.value.map(step => step.order)) + 1;
    select(draft);
  }
  return reactive({
    store, session, blueprint, steps, dirty, totalEntities,
    available: Boolean(host.serviceDesign), project: computed(() => studio.activeProject),
    labels: BLUEPRINT_LABELS, layers: BLUEPRINT_LAYERS,
    kinds: BLUEPRINT_KINDS.filter(kind => kind !== 'blueprint'),
    entities: computed(() => notes.value.filter(note => note.kind !== 'blueprint' && note.kind !== 'journey-step'
      && (!session.value.filter || `${note.title} ${BLUEPRINT_LABELS[note.kind]}`.toLowerCase().includes(session.value.filter.toLowerCase())))),
    related: computed(() => notes.value.filter(note => note.id !== session.value.draft?.id
      && (!session.value.relatedFilter || `${note.title} ${BLUEPRINT_LABELS[note.kind]}`.toLowerCase().includes(session.value.relatedFilter.toLowerCase())))),
    linked: computed(() => notes.value.filter(note => session.value.draft?.links.includes(note.id))),
    needsStep: computed(() => Boolean(session.value.draft && BLUEPRINT_LAYERS.includes(session.value.draft.kind))),
    select: (note: BlueprintNote) => select({ id: note.id, version: note.version, title: note.title,
      kind: note.kind, body: note.body, stepId: note.stepId, links: [...note.links], order: note.order }),
    begin,
    bindTitle: (value: Element | ComponentPublicInstance | null) => { titleInput.value = value instanceof HTMLInputElement ? value : null; },
    bindReplacement: (value: Element | ComponentPublicInstance | null) => { replacement.value = value instanceof HTMLElement ? value : null; },
    cells: (kind: BlueprintKind, stepId: string) => grid.value.get(`${kind}:${stepId}`) ?? [],
    cancelReplace: () => { session.value.pending = null; void nextTick(() => titleInput.value?.focus()); },
    replace: () => {
      const pending = session.value.pending;
      if (!pending) return;
      session.value.draft = pending; session.value.baseline = JSON.stringify(pending); session.value.pending = null;
      void nextTick(() => titleInput.value?.focus());
    },
    close: () => {
      if (dirty.value || store.busy) return;
      session.value.draft = null;
    },
    refresh: () => { void run(load); },
    save: () => {
      const id = projectId.value;
      const target = session.value;
      if (!target.draft || !host.serviceDesign) return;
      const draft = { ...target.draft, links: [...target.draft.links] };
      void run(async () => {
        const saved = await host.serviceDesign!.save(id, draft);
        const index = store.catalogue.notes.findIndex(note => note.id === saved.id);
        if (index < 0) store.catalogue.notes.push(saved); else store.catalogue.notes[index] = saved;
        store.catalogue.notes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
        target.draft = { ...draft, id: saved.id, version: saved.version, title: saved.title };
        target.baseline = JSON.stringify(target.draft);
        store.notice = `${BLUEPRINT_LABELS[saved.kind]} saved.`;
      });
    },
    configure: () => {
      const folder = store.folder;
      void run(async () => {
        if (!host.serviceDesign) return;
        store.catalogue = await host.serviceDesign.configure(folder); store.folder = store.catalogue.folder;
        store.notice = 'Service Design folder saved. Existing notes stay in their folders.';
      });
    },
    open: (id: string) => { void run(async () => { await host.serviceDesign?.open(id); }); },
  });
}
export type ServiceDesignModel = ReturnType<typeof useServiceDesign>;

/** Child form controls bind directly to the active project's retained store draft. */
export function useBlueprintDraft() {
  const studio = useStudioStore();
  const store = useServiceDesignStore();
  return computed(() => store.session(studio.activeProject?.id ?? ''));
}
