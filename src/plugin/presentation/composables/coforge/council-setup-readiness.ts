import type { CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import { resolveCouncilPlan } from '../../../features/coforge/application/council-execution';

/** Configuration facts only. A saved provider choice never proves a working connection. */
export function councilSetupReadiness(snapshot: CouncilCatalogueSnapshot, projectId: string) {
  const agents = snapshot.valid.filter(entry => entry.definition.schema === 'agent/v1' && entry.definition.enabled);
  const ids = new Set(agents.map(entry => entry.definition.id));
  const teams = snapshot.valid.filter(entry => entry.definition.schema === 'team/v1' && entry.definition.projectId === projectId);
  const usableTeams = teams.filter(entry => entry.definition.schema === 'team/v1' && entry.definition.enabled && entry.definition.members.some(id => ids.has(id)));
  const councils = snapshot.valid.filter(entry => entry.definition.schema === 'council/v1' && entry.definition.projectId === projectId);
  const configured = councils.filter(entry => {
    if (entry.definition.schema !== 'council/v1') return false;
    try { resolveCouncilPlan(snapshot, { kind: 'council', id: entry.definition.id, teamId: entry.definition.teamId }); return true; }
    catch { return false; }
  });
  return { agents, teams, usableTeams, councils, configured };
}
