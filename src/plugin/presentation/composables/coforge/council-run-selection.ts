import { watch } from 'vue';
import type { useCouncilStore } from '../../stores/coforge-council';

/** New inspections clear only controls tied to the previously selected run. */
export function useCouncilRunSelection(store: ReturnType<typeof useCouncilStore>) {
  watch(
    () => store.inspectedRun,
    () => {
      store.exportedRun = "";
      store.pruneConsent = false;
      store.reassignPath = "";
      store.acknowledge = false;
      store.skipReason = "";
      store.checkpointItems = [];
      store.checkpointNote = "";
      store.handoffIdeaId = "";
      store.handoffArtifactId = "";
      store.allowanceCalls = 0;
      store.allowanceMinutes = 0;
      store.allowanceScope = "";
      store.allowanceReason = "";
    },
  );
}
