import { oneOf, optional, shape, text } from './check';
import { contextEventId } from './integrity';
import type { HerdrAgent, HerdrSettings } from './herdr';
export interface AICostAttribution {
  kind: 'agent' | 'council' | 'workflow' | 'execution' | 'herdr';
  agentId?: string; agentName?: string; agentRevision?: string; agentNamespace?: 'reusable' | 'herdr';
  teamId?: string; teamName?: string; councilId?: string; councilName?: string;
  workflowName?: string; workflowRevision?: string;
  runId?: string; invocationId?: string; rootRunId?: string; parentRunId?: string; messageId?: string;
  subjectKind?: 'note' | 'idea';
}
const id = optional(text({ min: 1, max: 200 }));
const name = optional(text({ min: 1, max: 200 }));
export const aiCostAttributionCheck = shape({
  kind: oneOf(['agent', 'council', 'workflow', 'execution', 'herdr'] as const),
  agentId: id, agentName: name, agentRevision: id, agentNamespace: optional(oneOf(['reusable', 'herdr'] as const)),
  teamId: id, teamName: name, councilId: id, councilName: name,
  workflowName: name, workflowRevision: id, runId: id, invocationId: id,
  rootRunId: id, parentRunId: id, messageId: id, subjectKind: optional(oneOf(['note', 'idea'] as const)),
}, { strict: true });

export interface HerdrCostTarget { jobId: string; settings: HerdrSettings; target?: HerdrAgent }
export function herdrCostAttribution(session: string, target: HerdrAgent | undefined): AICostAttribution | undefined {
  if (!target) return undefined;
  return { kind: 'herdr', agentNamespace: 'herdr', agentName: target.name || target.agent,
    agentId: contextEventId(JSON.stringify([session, target.workspaceId, target.paneId, target.terminalId, target.sessionRef])) };
}
