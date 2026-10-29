import { useCouncilEntry } from './use-council-entry';
export function useEventTriggerLink() {
  const openCouncil = useCouncilEntry();
  return () => openCouncil({ page: 'events' });
}
