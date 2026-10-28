import { costSummary, formatUsd, type AICostTask } from './ai-costs';
import { tokenSummary } from './ai-usage';
export type CostDimension = 'agent' | 'team' | 'council';
export const COST_DIMENSIONS = [{ id: 'agent', label: 'By agent' }, { id: 'team', label: 'By team' }, { id: 'council', label: 'By Council' }] as const;
export function costGroupDisplay(summary: ReturnType<typeof costSummary>, count: number): string {
  if (summary.reported + summary.manual) return formatUsd(summary.nanos);
  if (summary.simulations === count) return 'Simulation';
  if (summary.notStarted === count) return 'No provider contacted';
  return summary.missing + summary.pending === 0 ? 'No priced invocations' : 'Unavailable';
}
export function attributionId(task: AICostTask, dimension: CostDimension): string | undefined {
  const attribution = task.attribution;
  if (dimension === 'agent') return attribution?.agentId ? `${attribution.agentNamespace ?? 'reusable'}:${attribution.agentId}` : undefined;
  const id = dimension === 'team' ? attribution?.teamId : attribution?.councilId;
  return id ? `${task.projectId}/${id}` : undefined;
}
export function attributionName(task: AICostTask, dimension: CostDimension): string {
  const attribution = task.attribution;
  if (dimension === 'agent') return attribution?.agentName || attribution?.agentId || 'Unattributed agent';
  return dimension === 'team' ? attribution?.teamName || attribution?.teamId || 'Unattributed team' : attribution?.councilName || attribution?.councilId || 'No recorded Council';
}
export function costAttributionGroups(tasks: readonly AICostTask[], dimension: CostDimension) {
  const grouped = new Map<string, AICostTask[]>();
  for (const task of tasks) {
    const id = attributionId(task, dimension);
    if (!id) continue;
    const group = grouped.get(id) ?? [];
    group.push(task); grouped.set(id, group);
  }
  return [...grouped.entries()].map(([id, group]) => {
    const summary = costSummary(group);
    const latest = [...group].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]!;
    return { id, dimension, name: attributionName(latest, dimension), project: dimension === 'agent' ? '' : latest.projectName || latest.projectId,
      summary, tokens: tokenSummary(group), count: group.length,
      display: costGroupDisplay(summary, group.length) };
  }).sort((a, b) => a.summary.nanos === b.summary.nanos ? a.name.localeCompare(b.name) : a.summary.nanos > b.summary.nanos ? -1 : 1);
}
export function attributionCoverage(tasks: readonly AICostTask[]) {
  return { total: tasks.length, agent: tasks.filter(task => attributionId(task, 'agent')).length,
    team: tasks.filter(task => attributionId(task, 'team')).length, council: tasks.filter(task => attributionId(task, 'council')).length };
}
