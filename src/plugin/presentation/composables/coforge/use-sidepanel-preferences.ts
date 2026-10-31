import { ref, watch } from 'vue';

const KEY = 'coforge:ui:sidepanels:v1';
interface PanelPreferences { navigation?: boolean; chat?: boolean }

function read(): PanelPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return {
      ...('navigation' in value && typeof value.navigation === 'boolean' ? { navigation: value.navigation } : {}),
      ...('chat' in value && typeof value.chat === 'boolean' ? { chat: value.chat } : {}),
    };
  } catch { return {}; }
}
function save(panel: keyof PanelPreferences, collapsed: boolean): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [panel]: collapsed })); }
  catch { /* A blocked local preference must not disable the panel controls. */ }
}

/** Explicit local UI choices survive reload; responsive defaults remain view-local. */
export function useSidepanelPreferences() {
  const stored = read();
  const leftPanelCollapsed = ref(stored.navigation ?? false);
  const rightPanelCollapsed = ref(stored.chat ?? false);
  const rightPanelManual = ref(stored.chat !== undefined);
  watch(leftPanelCollapsed, collapsed => save('navigation', collapsed), { flush: 'sync' });
  watch(rightPanelCollapsed, collapsed => {
    if (rightPanelManual.value) save('chat', collapsed);
  }, { flush: 'sync' });
  return { leftPanelCollapsed, rightPanelCollapsed, rightPanelManual };
}
