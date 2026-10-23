
import type { Pinia } from 'pinia';
import type { Sources } from '../application/sources.ts';
import type { VisualContext } from '../presentation/composables/use-visual.ts';
import { screens } from '../domain/screens.ts';
import { useNavigation } from '../presentation/stores/navigation.ts';
import { handleVisualInteraction } from '../application/visual-interactions.ts';
export function createVisualContext(sources: Sources, pinia: Pinia, openModal: (id: string) => void): VisualContext {

const navigation = useNavigation(pinia);
return { ports: [], handle: request => handleVisualInteraction(request, sources), navigate(target) {
  const screen = screens.find(s => s.id === target); if (!screen || ['action', 'group'].includes(screen.kind)) throw new Error('SCREEN_NOT_NAVIGABLE');
  if (screen.kind === 'modal') openModal(target); else navigation.open(target);
} };
}
