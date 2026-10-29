// @vitest-environment happy-dom
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { expect, it } from 'vitest';
import { useWorkflowTriggersStore } from '../../../presentation/stores/coforge-workflow-triggers';
import { resetCouncilExample } from '../../../presentation/composables/coforge/council-example-reset';

it('discards event-trigger example drafts with the Council example while preserving native drafts', () => {
  const pinia = createPinia(); setActivePinia(pinia);
  try {
    const form = useWorkflowTriggersStore();
    form.example = true; form.id = 'example-binding'; form.acknowledge = true; form.draft.name = 'Temporary example';
    resetCouncilExample();
    expect(form.example).toBe(false); expect(form.id).toBe(''); expect(form.acknowledge).toBe(false); expect(form.draft.name).toBe('');
    form.draft.name = 'Native workflow trigger'; form.id = 'native-binding';
    resetCouncilExample();
    expect(form.draft.name).toBe('Native workflow trigger'); expect(form.id).toBe('native-binding');
  } finally { disposePinia(pinia); }
});
