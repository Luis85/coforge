import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BlueprintCatalogue, BlueprintInput, BlueprintKind } from '../../features/service-design/domain/blueprint';

export function blueprintDraft(kind: BlueprintKind, stepId = ''): BlueprintInput {
  return { kind, title: '', body: '', order: 0, stepId, links: [] };
}
export interface BlueprintSession {
  draft: BlueprintInput | null;
  baseline: string;
  pending: BlueprintInput | null;
  newKind: BlueprintKind;
  filter: string;
  relatedFilter: string;
}
export const useServiceDesignStore = defineStore('service-design', () => {
  const catalogue = ref<BlueprintCatalogue>({ folder: 'CoForge/Service Design', notes: [], warnings: [] });
  const sessions = ref<Record<string, BlueprintSession>>({});
  const folder = ref('CoForge/Service Design');
  const loaded = ref(false);
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  function session(projectId: string): BlueprintSession {
    return sessions.value[projectId] ??= { draft: null, baseline: '', pending: null, newKind: 'journey-step', filter: '', relatedFilter: '' };
  }
  return { catalogue, sessions, folder, loaded, busy, error, notice, session };
});
