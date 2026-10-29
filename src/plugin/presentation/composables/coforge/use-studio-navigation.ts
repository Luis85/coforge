import { computed, useId } from "vue";
import { STUDIO_GROUPS } from "../../stores/studio-destinations";
import type { StudioView } from "../../stores/coforge-studio";
import { useCouncilStore } from "../../stores/coforge-council";
import { useStudioShell } from "./use-studio-app";
import { useNavigationGroups } from './use-navigation-groups';
/** Group existing destinations by the streamer's task without duplicating navigation state. */
export function useStudioNavigation() {
  const shell = useStudioShell();
  const council = useCouncilStore();
  const state = useNavigationGroups();
  const prefix = `${shell.store.layoutId}-${useId()}`;
  const groups = computed(() =>
    STUDIO_GROUPS.map((group) => ({
      ...group,
      expanded: state.expanded(group.id),
      controls: `${prefix}-navigation-${group.id}`,
      items: shell.nav.filter((item) => item.group === group.id),
    })).filter((group) => group.items.length),
  );
  return {
    shell,
    groups,
    toggleGroup: state.toggle,
    navigate: (view: StudioView) => {
      if (shell.store.navigate(view) && view === "council") council.tab = "ask";
    },
  };
}
