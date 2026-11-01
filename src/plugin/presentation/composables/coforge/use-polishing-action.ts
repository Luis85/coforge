import { usePolishingUiStore } from '../../stores/coforge-polishing-ui';

export function usePolishingAction() {
  const modal = usePolishingUiStore();
  return { open: (ideaId: string, event?: Event) => {
    const element = event?.currentTarget;
    modal.open(ideaId, element instanceof HTMLElement ? element : null);
  } };
}
