import { ref } from 'vue';
import { STUDIO_GROUPS, type StudioGroup } from '../../stores/studio-destinations';

const KEY = 'coforge:ui:navigation-groups:v1';
const knownGroup = (value: unknown): value is StudioGroup => STUDIO_GROUPS.some(group => group.id === value);

/** Local interface preferences never write project definitions or dispatch work. */
export function useNavigationGroups() {
  function read(): StudioGroup[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      return Array.isArray(value) ? value.filter(knownGroup) : [];
    } catch { return []; }
  }
  const collapsed = ref(read());
  return {
    expanded: (id: StudioGroup) => !collapsed.value.includes(id),
    toggle: (id: StudioGroup) => {
      collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(value => value !== id) : [...collapsed.value, id];
      try { localStorage.setItem(KEY, JSON.stringify(collapsed.value)); }
      catch { /* The control remains usable when local preferences cannot be saved. */ }
    },
  };
}
