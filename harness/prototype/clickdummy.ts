import { createApp, ref, watch, type App } from 'vue';
import ui from '@nuxt/ui/vue-plugin';
import { createPinia, disposePinia } from 'pinia';
import Preview from "../../src/plugin/generated/presentation/components/ClickdummyPreview.vue";
import Workbench from "../../src/plugin/generated/presentation/components/ProjectWorkbench.vue";
import { panels } from "../../src/plugin/generated/bootstrap/panels.ts";
import { projectKey } from "../../src/plugin/generated/presentation/context/project.ts";
import { clickdummyKey } from "../../src/plugin/generated/presentation/context/clickdummy.ts";
import { createClickdummySources } from "../../src/plugin/generated/bootstrap/clickdummy-sources.ts";
import { bindFlows } from "../../src/plugin/generated/bootstrap/flows.ts";
import { createVisualContext } from "../../src/plugin/generated/bootstrap/visual-context.ts";
import { provideVisualContext } from "../../src/plugin/generated/presentation/composables/use-visual.ts";
import { useNavigation } from "../../src/plugin/generated/presentation/stores/navigation.ts";
import { screens } from "../../src/plugin/generated/domain/screens.ts";
import type { VisualState } from "../../src/plugin/generated/domain/visual-runtime.ts";
import { createDialogHost, createPreviewLifecycle } from './clickdummy-host.ts';
import { scenariosForSurface, resolveScenario, type PreviewScenario } from './clickdummy-scenarios.ts';
import './clickdummy.css';
import '../../src/plugin/styles/app.css';
import "../../src/plugin/generated/styles/project.css";
import "../../src/plugin/generated/presentation/detail-layout.css";
const root = document.getElementById('prototype-app');
if (!root) throw new Error('CLICKDUMMY_ROOT');
const owner = "coforge", name = "CoForge";
const routes: ReadonlyArray<{id: string; surface: string; path: string}> = [];
const state = ref<VisualState>('default'), error = ref('');
const dialogs = createDialogHost({ document, owner,
  label: id => screens.find(s => s.id === id && s.kind === 'modal')?.label,
  mount: (target, id) => mountFrame(target, id), error: message => { error.value = message; } });
function openModal(id: string, scenarioReadOnly = false) {
  dialogs.open(id, (target, surface) => mountFrame(target, surface, scenarioReadOnly));
}
// The host token scope is .obsidian-harness; without it the theme class would not restyle anything.
document.body.classList.add('obsidian-harness', 'theme-dark');
function fail() { error.value = 'This surface contains an unimplemented capability. It is not accepted functionality.'; }
function exportProject() {
  const data = JSON.parse(document.getElementById('prototype-project-data')?.textContent ?? '{}');
  if (data.encoding !== 'base64' || typeof data.content !== 'string') { fail(); return; }
  const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = owner + '.companion.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function mountFrame(target: HTMLElement, modal?: string, inheritedReadOnly = false): () => void {
  const pinia = createPinia(), sources = createClickdummySources(), navigation = useNavigation(pinia);
  const selection = ref<PreviewScenario | null>(null);
  const scenarioReadOnly = () => inheritedReadOnly || selection.value !== null;
  const frameOpenModal = (id: string) => openModal(id, scenarioReadOnly());
  if (modal) navigation.open(modal);
  let initial: string | undefined;
  try { if (!modal && location.hash.startsWith('#surface=')) initial = decodeURIComponent(location.hash.slice(9)); } catch { error.value = 'Invalid preview address.'; }
  if (initial && screens.some(s => s.id === initial && !['group','action','modal'].includes(s.kind))) navigation.open(initial);
  const app: App = createApp(modal ? Workbench : Preview); app.use(pinia); app.use(ui);
  const stops: Array<() => void> = [];
  app.runWithContext(() => {
    app.provide(projectKey, { panels, flows: bindFlows(sources,pinia), isolated: !!modal, openModal: frameOpenModal, designState: () => state.value });
    provideVisualContext(app, { ...createVisualContext(sources,pinia,frameOpenModal), scenarioReadOnly,
      scenario: definition => selection.value?.definition === definition ? selection.value.id : undefined });
  });
  if (!modal) {
    const open = (id: string) => {
      if (screens.some(s => s.id === id && s.kind === 'modal')) frameOpenModal(id);
      else if (screens.some(s => s.id === id && !['group','action'].includes(s.kind))) navigation.open(id);
    };
    app.provide(clickdummyKey, { name, state, error, current: () => navigation.current,
      surfaces: screens.filter(s => !['group','action','modal'].includes(s.kind)), route: () => routes.find(r => r.surface === navigation.current)?.path ?? '',
      scenarios: () => scenariosForSurface(navigation.current), scenario: () => selection.value?.id ?? '',
      selectScenario(id) {
        try { const next = resolveScenario(navigation.current, id);
          selection.value = next; state.value = next?.state ?? 'default'; error.value = '';
        } catch { error.value = 'This authored scenario is not available on the current surface.'; }
      }, open, reset, exportProject });
    stops.push(watch(() => navigation.current, () => {
      if (selection.value) { selection.value = null; state.value = 'default'; }
    }, { flush: 'sync' }));
    // Surface hashes are preview addresses, not invented route records. Authored route metadata is displayed separately.
    const incoming = () => { try { const id = decodeURIComponent(location.hash.slice(9)); if (location.hash.startsWith('#surface=') && screens.some(s => s.id === id && !['group','action','modal'].includes(s.kind))) navigation.open(id); } catch { error.value = 'Invalid preview address.'; } };
    window.addEventListener('hashchange', incoming); stops.push(() => window.removeEventListener('hashchange', incoming));
    stops.push(watch(() => navigation.current, id => { const hash = '#surface=' + encodeURIComponent(id); if (location.hash !== hash) location.hash = hash; }));
  }
  let released = false;
  const dispose = () => {
    if (released) return; released = true;
    try { stops.forEach(stop => stop()); app.unmount(); }
    finally { disposePinia(pinia); if (!modal) delete document.documentElement.dataset.prototypeReady; }
  };
  app.config.errorHandler = fail;
  try { app.mount(target); if (!modal && target.querySelector('.clickdummy-preview')) document.documentElement.dataset.prototypeReady = 'true'; }
  catch (cause) { dispose(); throw cause; }
  return dispose;
}
function reset() {
  state.value = 'default'; error.value = ''; history.replaceState(null, '', location.pathname + location.search);
  lifecycle.reset(); document.getElementById('clickdummy-reset')?.focus({ preventScroll: true });
}
const lifecycle = createPreviewLifecycle(window, { mount: () => mountFrame(root!), closeDialogs: dialogs.closeAll,
  error: message => { error.value = message; } });
