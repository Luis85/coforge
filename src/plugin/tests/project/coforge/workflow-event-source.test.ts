import { expect, it } from 'vitest';
import { studioAutomationEvent } from '../../../infrastructure/coforge/workflow-event-source';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
it('resolves event identity and causation from the affected entity instead of the selected project', () => {
  const state = createSeed(); const idea = state.ideas[0]!; state.activeProjectId = 'CFP-999';
  const at = new Date().toISOString();
  idea.workflowRun = { id: 'run-event', ideaId: idea.id, projectId: 'CFP-001', definition: defaultWorkflowDefinition(state.settings), proposalRevision: workflowProposalRevision(idea), revision: 1, cursor: 0, state: 'running', attempts: [], artifacts: [], createdAt: at, updatedAt: at,
    automationEvent: { id: 'root-event', type: 'request-created', at, origin: { rootEventId: 'root-event', bindingIds: ['binding-one'] } } };
  const event = { revision: 1, type: 'workflow-run-started' as const, record: { code: 'workflow-run-started' as const, effect: 'committed' as const, count: 1, sequence: 10, at, entityId: 'run-event' } };
  expect(studioAutomationEvent(event, state)).toMatchObject({ projectId: 'CFP-001', ideaId: idea.id, runId: 'run-event', origin: { bindingIds: ['binding-one'] } });
  expect(studioAutomationEvent({ ...event, record: { ...event.record, entityId: undefined } }, state).projectId).toBeUndefined();
});
