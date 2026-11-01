import { herdrReady, sameHerdrAgent, type HerdrState } from '../domain/herdr';
import type { HerdrWorkflowState } from './herdr-workflow-ports';
import type { ExecutionRun } from '../domain/execution-run';

/** Test requests can own real external work. Removing their notes never settles an external attempt. */
export function assertExampleHostSettled(
  ids: readonly string[], manual: HerdrState, managed: HerdrWorkflowState,
  council: readonly Pick<ExecutionRun, 'subject' | 'state' | 'attempts'>[],
): void {
  const selected = new Set(ids);
  if (manual.busy || managed.busy || !managed.ready)
    throw new Error('Wait for Herdr recovery journals and active actions before removing requests.');
  if (managed.records.some(record => selected.has(record.ideaId) && !['completed', 'reviewed'].includes(record.phase)))
    throw new Error('Inspect and acknowledge the selected request’s Herdr workflow recovery before cleanup.');
  for (const record of manual.records) {
    if (!record.ideaId || !selected.has(record.ideaId) || record.status === 'reviewed') continue;
    if (record.status !== 'delivered') throw new Error('Inspect and acknowledge the selected request’s unconfirmed Herdr action before cleanup.');
    const target = record.target;
    const observed = target && manual.observation?.agents.find(agent => sameHerdrAgent(agent, target));
    if (!observed || !herdrReady(observed) || !manual.checkedAt || Date.parse(manual.checkedAt) <= Date.parse(record.at))
      throw new Error('Refresh Herdr and verify the selected request’s agent is idle before cleanup. Delivery does not establish completion.');
  }
  if (council.some(run => run.subject.kind === 'idea' && selected.has(run.subject.ideaId)
    && (!['completed', 'cancelled'].includes(run.state) || run.attempts.some(attempt => ['dispatching', 'unknown'].includes(attempt.status) && !attempt.uncertaintyAcknowledgedAt))))
    throw new Error('Finish or cancel the selected request’s Council work and acknowledge unknown outcomes before cleanup.');
}
