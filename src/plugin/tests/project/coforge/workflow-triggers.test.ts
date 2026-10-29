import { afterEach, expect, it } from 'vitest';
import { WorkflowTriggers } from '../../../features/coforge/application/workflow-triggers';
import { emptyWorkflowTriggers, type WorkflowTriggerDraft, type WorkflowTriggerState } from '../../../features/coforge/domain/workflow-triggers';
import type { AutomationContext, AutomationOrigin } from '../../../features/coforge/domain/automation-context';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture(initial = emptyWorkflowTriggers()) {
  let state = structuredClone(initial); let now = Date.parse('2026-10-28T10:00:00Z'); let ready = true; let revision = 'definition-one'; let fail = false; let unknown = false;
  const calls: Array<{ rule: WorkflowTriggerDraft; event: AutomationContext; origin: AutomationOrigin }> = []; const active = new Set<string>();
  const service = new WorkflowTriggers({ load: async () => structuredClone(state), save: async value => { if (fail) throw new Error('Disk'); state = structuredClone(value); } }, {
    owned: () => true, configure: async () => {}, readiness: () => ({ ready, reason: 'Execution paused' }),
    describe: async () => ({ revision, definitionJson: '{"pinned":true}', subject: 'idea' }), active: (_kind, id) => active.has(id),
    subscribe: () => () => {}, dispatch: async (rule, occurrence, origin) => { calls.push({ rule, event: occurrence.event, origin }); if (unknown) throw new Error('Unknown'); const runId = `run-${calls.length}`; active.add(runId); return { runId }; },
  }, () => now);
  await service.start(); cleanups.push(() => service.dispose());
  const draft: WorkflowTriggerDraft = { name: 'Build new requests', enabled: true, event: 'request-created', scope: 'project', projectId: 'CFP-001', workflow: 'v1', workflowRevision: 'definition-one', request: 'event', cooldownSeconds: 1 };
  const event = (id: string, extra: Partial<AutomationContext> = {}): AutomationContext => ({ id, type: 'request-created', at: new Date(now).toISOString(), projectId: 'CFP-001', ideaId: 'CF-101', ...extra });
  return { service, draft, event, calls, active, data: (): WorkflowTriggerState => state, advance: (ms: number) => { now += ms; }, pause: () => { ready = false; }, change: () => { revision = 'definition-two'; }, fail: () => { fail = true; }, unknown: () => { unknown = true; } };
}
it('routes existing requests and pins event/definition snapshots before effects with event deduplication', async () => {
  const f = await fixture(); await f.service.save(f.draft); await f.service.observe(f.event('event-one')); await f.service.observe(f.event('event-one'));
  expect(f.calls).toHaveLength(1); expect(f.calls[0]).toMatchObject({ rule: { workflow: 'v1', projectId: 'CFP-001' }, event: { ideaId: 'CF-101' }, origin: { rootEventId: 'event-one' } });
  expect(f.service.snapshot().occurrences[0]).toMatchObject({ status: 'submitted', definitionJson: '{"pinned":true}', event: { id: 'event-one' } });
});
it('skips wrong projects, missing requests, paused execution, active runs and unreviewed definition changes', async () => {
  const f = await fixture(); await f.service.save(f.draft); await f.service.observe(f.event('wrong', { projectId: 'CFP-002' })); expect(f.calls).toEqual([]);
  await f.service.observe(f.event('missing', { ideaId: undefined })); expect(f.calls).toEqual([]);
  await f.service.observe(f.event('first')); f.advance(2000); await f.service.observe(f.event('overlap')); expect(f.calls).toHaveLength(1);
  f.active.clear(); f.pause(); f.advance(2000); await f.service.observe(f.event('paused')); expect(f.calls).toHaveLength(1);
  const changed = await fixture(); await changed.service.save(changed.draft); changed.change(); await changed.service.observe(changed.event('stale')); expect(changed.calls).toEqual([]); expect(changed.service.snapshot().bindings[0]?.enabled).toBe(false);
});
it('supports application-triggered Council workflows and bounds causation chains instead of looping', async () => {
  const f = await fixture(); await f.service.save({ ...f.draft, scope: 'application', workflow: 'v2', request: 'fixed', ideaId: 'CF-101' });
  const ruleId = f.service.snapshot().bindings[0]!.id;
  await f.service.observe(f.event('loop', { origin: { rootEventId: 'root', bindingIds: [ruleId] } })); expect(f.calls).toEqual([]);
  await f.service.observe(f.event('depth', { origin: { rootEventId: 'root', bindingIds: ['a', 'b', 'c', 'd'] } })); expect(f.calls).toEqual([]);
  await f.service.observe(f.event('valid', { projectId: undefined, ideaId: undefined })); expect(f.calls).toHaveLength(1); expect(f.calls[0]?.origin.bindingIds).toEqual([ruleId]);
});
it('fails closed on reservation writes and never replays uncertain admissions on reload', async () => {
  const failed = await fixture(); await failed.service.save(failed.draft); failed.fail(); await expect(failed.service.observe(failed.event('no-write'))).rejects.toThrow(); expect(failed.calls).toEqual([]);
  const f = await fixture(); await f.service.save(f.draft); f.unknown(); await f.service.observe(f.event('unknown')); expect(f.service.snapshot().bindings[0]?.enabled).toBe(false);
  const reopened = await fixture(f.data()); await reopened.service.observe(reopened.event('unknown')); expect(reopened.calls).toEqual([]);
  const rule = reopened.service.snapshot().bindings[0]!; await expect(reopened.service.save(reopened.draft, rule.id, rule.revision)).rejects.toThrow('acknowledge');
});
