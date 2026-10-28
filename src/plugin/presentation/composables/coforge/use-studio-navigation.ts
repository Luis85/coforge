import { computed } from "vue";
import type { StudioView } from "../../stores/coforge-studio";
import { useStudioShell } from "./use-studio-app";

type Group = "stream" | "build" | "community" | "insights";
const DESTINATIONS: Record<StudioView, Group> = {
  broadcast: "stream",
  schedule: "stream",
  stream: "stream",
  board: "build",
  workflow: "build",
  projects: "build",
  settings: "build",
  community: "community",
  population: "community",
  "community-settings": "community",
  statistics: "insights",
  "ai-costs": "insights",
  finance: "insights",
  operations: "insights",
};
const GROUPS: Array<{ id: Group; label: string }> = [
  { id: "build", label: "Build" },
  { id: "stream", label: "Stream" },
  { id: "community", label: "Community" },
  { id: "insights", label: "Insights" },
];
const ORDER: StudioView[] = [
  "board",
  "workflow",
  "broadcast",
  "schedule",
  "stream",
  "community",
  "population",
  "statistics",
  "ai-costs",
  "finance",
  "operations",
];
const position = (view: StudioView): number => {
  const index = ORDER.indexOf(view);
  return index < 0 ? ORDER.length : index;
};
/** Group existing destinations by the streamer's task without duplicating navigation state. */
export function useStudioNavigation() {
  const shell = useStudioShell();
  const groups = computed(() =>
    GROUPS.map((group) => ({
      ...group,
      items: shell.nav
        .filter((item) => DESTINATIONS[item.view] === group.id)
        .sort((left, right) => position(left.view) - position(right.view)),
    })).filter((group) => group.items.length),
  );
  return { shell, groups };
}
