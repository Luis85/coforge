import { routeIntake } from '../domain/intake-bindings';
import type { CouncilPreferences } from './council-ports';

/** Generated sources cannot enter another intake lane and lose their automation provenance. */
export function automationSourceGuard(host: { snapshot(): { preferences: CouncilPreferences }; assertExecutor?(): Promise<void> }, path: string): () => Promise<void> {
  const captured = structuredClone(host.snapshot().preferences.bindings);
  return async () => {
    await host.assertExecutor?.();
    const bindings = [...captured, ...host.snapshot().preferences.bindings];
    if (bindings.some(binding => routeIntake([binding], path))) throw new Error('A watched inbox would ingest this generated automation source. Repair the overlapping inbox binding and inspect the original source/run before enabling future automation. Saved preferences were preserved.');
  };
}
