import type { VisualRequest } from '../domain/visual-runtime.ts';
import type { Sources } from './sources.ts';
export const handleVisualInteraction: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new Error('VISUAL_INTERACTION_UNKNOWN'); };
