import { inject, type InjectionKey } from 'vue';
import type { StudioHostActions } from '../../features/coforge/application/ports';
import type { StudioService } from '../../features/coforge/application/studio';

export type StudioNotice = { message: string; error: boolean };
/** What a mounted CoForge view receives from the plugin runtime. */
export interface CoforgeContext {
  studio: StudioService;
  host: StudioHostActions;
  onNotice(listener: (notice: StudioNotice) => void): () => void;
  /** Why the studio could not load, if it failed. */
  startupError(): string | null;
}
export const coforgeKey: InjectionKey<CoforgeContext> = Symbol('coforge');

export function useCoforge(): CoforgeContext {
  const context = inject(coforgeKey, null);
  if (!context) throw new Error('COFORGE_CONTEXT_MISSING');
  return context;
}
