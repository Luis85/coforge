// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { expect, it, vi } from 'vitest';
import { IDEA_STATUSES } from '../../../features/coforge/domain/types';
import { useIdeaCardMenu } from '../../../presentation/composables/coforge/use-idea-card-menu';
import { usePolishingUiStore } from '../../../presentation/stores/coforge-polishing-ui';
import { retryUiFixture } from './background-build-retry-ui-fixture';

it('offers the same feedback intent in every bucket including accepted cards without previewing or dispatching, scoped to each mounted app', async () => {
  const f = await retryUiFixture(); const modal = usePolishingUiStore(f.pinia); const other = createPinia();
  const foreign = usePolishingUiStore(other); const inspect = vi.spyOn(f.studio, 'previewPolishingPass');
  let menu: ReturnType<typeof useIdeaCardMenu> | undefined;
  const Probe = defineComponent({ setup() { menu = useIdeaCardMenu({ idea: f.idea }, { voted: false, voteDisabled: true, vote() {} }); return () => h('div'); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  try {
    for (const status of IDEA_STATUSES) {
      f.idea.status = status; await flushPromises();
      const action = menu!.items.flat().find(item => item.label === 'Improve & polish');
      expect(action, status).toBeDefined(); expect(action!.disabled, status).not.toBe(true);
      action!.onSelect?.(new Event('select')); await flushPromises();
      expect(modal.ideaId).toBe(f.idea.id); expect(foreign.isOpen).toBe(false);
      modal.feedback = `Keep the ${status} feedback draft.`; modal.close();
    }
    expect(inspect).not.toHaveBeenCalled(); expect(f.confirm).not.toHaveBeenCalled(); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); disposePinia(other); await f.dispose(); }
});
