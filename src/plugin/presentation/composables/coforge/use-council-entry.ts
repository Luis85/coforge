import { useCouncilStore, type CouncilEntryIntent } from '../../stores/coforge-council';
import { useStudioStore } from '../../stores/coforge-studio';

/** Consume once at the authorized navigation boundary; unrelated later entry remains Ask. */
export function consumeCouncilEntry(council: ReturnType<typeof useCouncilStore>, studio: ReturnType<typeof useStudioStore>): void {
  const intent = council.entryIntent;
  council.entryIntent = null;
  if (!intent || intent.navigationRevision !== studio.navigationRevision) { council.tab = 'ask'; return; }
  council.tab = intent.page;
  if (intent.runId !== undefined || intent.projectId !== undefined) {
    council.projectFilter = intent.projectId ?? studio.state?.activeProjectId ?? '';
    council.stateFilter = ''; council.teamFilter = ''; council.targetFilter = ''; council.sourceFilter = '';
    if (intent.runId !== undefined) council.inspectedRun = intent.runId;
  }
}
export function useCouncilEntry() {
  const council = useCouncilStore(); const studio = useStudioStore();
  return (entry: Omit<CouncilEntryIntent, 'navigationRevision'>): boolean => {
    if (!studio.featureEnabled('council') || !studio.navigate('council')) return false;
    council.entryIntent = { ...entry, navigationRevision: studio.navigationRevision };
    if (council.viewMounted) consumeCouncilEntry(council, studio);
    return true;
  };
}
