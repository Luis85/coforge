import { computed } from "vue";
import { STUDIO_GROUPS } from "../../stores/studio-destinations";
import type { StudioView } from "../../stores/coforge-studio";
import { useCouncilStore } from "../../stores/coforge-council";
import { useStudioShell } from "./use-studio-app";
/** Group existing destinations by the streamer's task without duplicating navigation state. */
export function useStudioNavigation() {
  const shell = useStudioShell();
  const council = useCouncilStore();
  const groups = computed(() =>
    STUDIO_GROUPS.map((group) => ({
      ...group,
      items: shell.nav.filter((item) => item.group === group.id),
    })).filter((group) => group.items.length),
  );
  return {
    shell,
    groups,
    navigate: (view: StudioView) => {
      if (shell.store.navigate(view) && view === "council") council.tab = "ask";
    },
  };
}
