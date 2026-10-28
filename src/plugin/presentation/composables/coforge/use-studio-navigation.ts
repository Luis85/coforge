import { computed } from "vue";
import { STUDIO_GROUPS } from "../../stores/studio-destinations";
import { useStudioShell } from "./use-studio-app";
/** Group existing destinations by the streamer's task without duplicating navigation state. */
export function useStudioNavigation() {
  const shell = useStudioShell();
  const groups = computed(() =>
    STUDIO_GROUPS.map((group) => ({
      ...group,
      items: shell.nav.filter((item) => item.group === group.id),
    })).filter((group) => group.items.length),
  );
  return { shell, groups };
}
