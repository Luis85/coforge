export interface PreviewScenario {
  id: string; definition: string; surface: string; name: string;
  state: 'default' | 'loading' | 'empty' | 'error' | 'disabled'; width: 'wide' | 'narrow';
}
const scenarios: readonly PreviewScenario[] = [];
/** Detached choices are scoped by canonical surface, never a similarly named page. */
export function scenariosForSurface(surface: string): PreviewScenario[] {
  return scenarios.filter(item => item.surface === surface).map(item => ({ ...item }));
}
export function resolveScenario(surface: string, id: string): PreviewScenario | null {
  if (id === '') return null;
  const scenario = scenariosForSurface(surface).find(item => item.id === id);
  if (!scenario) throw new Error('PREVIEW_SCENARIO_UNAVAILABLE');
  return scenario;
}
