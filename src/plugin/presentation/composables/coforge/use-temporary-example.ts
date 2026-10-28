import { watch } from "vue";
import { useStudioStore } from "../../stores/coforge-studio";

/** A per-leaf explicit cleanup signal; ordinary navigation leaves preview drafts intact. */
export function useTemporaryExample(id: string, exit: () => void) {
  const studio = useStudioStore();
  const reconcile = () => {
    if (!studio.temporaryExampleExpired(id)) return;
    exit();
    studio.beginTemporaryExample(id);
  };
  reconcile();
  watch(() => studio.temporaryExampleRevision, reconcile, { flush: "sync" });
  return () => {
    studio.beginTemporaryExample(id);
  };
}
