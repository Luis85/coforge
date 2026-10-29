import { useCouncilStore } from "../../stores/coforge-council";
import { useStudioStore } from "../../stores/coforge-studio";
export function useEventTriggerLink() {
  const council = useCouncilStore();
  const studio = useStudioStore();
  return () => {
    council.tab = "events";
    studio.navigate("council");
  };
}
