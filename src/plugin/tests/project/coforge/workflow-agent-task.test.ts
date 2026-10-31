// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { CouncilModule } from '../../../infrastructure/coforge/council-module';
import { workflowAgentTasks } from '../../../infrastructure/coforge/workflow-agent-task';
import { workflowTriggerHost } from '../../../infrastructure/coforge/workflow-trigger-host';
import { VaultProjects } from '../../../infrastructure/coforge/vault-projects';
import { defaultWorkflowDefinition, workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import type { WorkflowTriggerDraft, WorkflowTriggerOccurrence } from '../../../features/coforge/domain/workflow-triggers';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';
import { StudioService } from '../../../features/coforge/application/studio';
import { decodeCouncilPlan } from '../../../features/coforge/application/council-execution';
import { defaultCouncilDefinition } from '../../../features/coforge/domain/council-definitions';
import { createSeed } from '../../../features/coforge/domain/seed';
import { AgentTaskNotStartedError } from '../../../features/coforge/application/agent-task';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('captures an enabled reusable CoWorker without a Team or delegation and rejects later disablement', async () => {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const timers = nodeTimers(); const gate = new InvocationGate();
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) }); await studio.start();
  const module = new CouncilModule(plugin, studio, timers, gate); await module.start();
  try {
    await module.actions.catalogue.save({ schema: 'agent/v1', id: 'profile-only', name: 'Profile only', enabled: true, role: 'Reviewer', instructions: 'Preserve compatibility.', provider: 'claude', model: 'sonnet', effort: 'high', contextSources: ['Private/context.md'], requestedCapabilities: { project: 'read', messaging: true } });
    const entry = (await module.actions.catalogue.list()).valid.find(item => item.definition.id === 'profile-only');
    if (!entry || entry.definition.schema !== 'agent/v1') throw new Error('Expected saved profile');
    const port = workflowAgentTasks(plugin, studio, module.actions);
    const profile = await port.prepareCoworker!(studio.state().activeProjectId!, 'profile-only');
    expect(profile).toMatchObject({ id: 'profile-only', revision: entry.revision, role: 'Reviewer', model: 'sonnet', effort: 'high' });
    expect(profile).not.toHaveProperty('contextSources'); expect(profile).not.toHaveProperty('requestedCapabilities');
    expect((await module.actions.catalogue.list()).valid.some(item => item.definition.schema === 'team/v1')).toBe(false);
    await module.actions.catalogue.save({ ...entry.definition, enabled: false }, entry.revision);
    await expect(port.prepareCoworker!(studio.state().activeProjectId!, 'profile-only')).rejects.toThrow('disabled');
    expect(module.actions.snapshot().runs).toHaveLength(0); expect(kit.errors).toEqual([]);
  } finally { await module.dispose(); gate.dispose(); await studio.stop(); }
});

it('admits one allowed project agent with captured context and tighter parent limits, preserving sources and rejecting replay', async () => {
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', author: '', description: '' });
  const timers = nodeTimers(); const gate = new InvocationGate();
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: true, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.store.updateRuntime({ cliAvailable: true });
  const module = new CouncilModule(plugin, studio, timers, gate); await module.start(); await module.actions.designateExecutor();
  try {
    const projectId = studio.state().activeProjectId!;
    const setup = await module.actions.catalogue.setup(projectId);
    await module.actions.catalogue.save({ schema: 'agent/v1', id: 'reviewer', name: 'Reviewer', enabled: true, role: 'Review', instructions: 'Review supplied context.', provider: 'claude', model: 'sonnet', contextSources: [], requestedCapabilities: { project: 'none', messaging: false } });
    const entry = setup.valid.find(entry => entry.definition.schema === 'team/v1')!;
    if (entry.definition.schema !== 'team/v1') throw new Error('Expected team');
    await module.actions.catalogue.save({ ...entry.definition, members: ['reviewer'], allowedRecipients: ['reviewer'] }, entry.revision);
    // Keep the actual kernel paused; no provider is started by this admission integration test.
    let watched = false;
    const actions = { ...module.actions, snapshot: () => { const state = module.actions.snapshot(); return { ...state, paused: false, preferences: watched ? { ...state.preferences, bindings: [{ id: 'raced-watch', path: 'CoForge/Automations', projectId, teamId: entry.definition.id, target: { kind: 'agent' as const, id: 'reviewer' }, enabled: true, recursive: true, submit: 'after-stable' as const, settleMs: 0 }] } : state.preferences }; } };
    const port = workflowAgentTasks(plugin, studio, actions);
    const input = { projectId, ideaId: 'CF-001', workflowRunId: 'workflow-one', attemptId: 'attempt-one', stepId: 'nudge', teamId: entry.definition.id, agentId: 'reviewer', prompt: 'Find risks.', context: '{"captured":"request"}', sourcePath: 'CoForge/Automations/nudge-attempt-one.md', limits: { timeoutSeconds: 30, maxTurns: 2, maxBudgetUsd: 0.2 }, signal: new AbortController().signal };
    const receipt = await port.create(input);
    const run = module.actions.snapshot().runs.find(run => run.id === receipt.runId)!;
    expect(decodeCouncilPlan(run).invocations.map(invocation => invocation.agent.id)).toEqual(['reviewer']);
    expect(run.limits).toMatchObject(input.limits);
    const original = kit.read(receipt.sourcePath); expect(original).toContain('Find risks.'); expect(original).toContain(input.context);
    await expect(port.create(input)).rejects.toThrow('already exists'); expect(kit.read(receipt.sourcePath)).toBe(original);
    await expect(port.create({ ...input, attemptId: 'attempt-two', sourcePath: 'CoForge/Automations/nudge-attempt-two.md', agentId: 'outsider' })).rejects.toThrow();
    expect(app.vault.getAbstractFileByPath('CoForge/Automations/nudge-attempt-two.md')).toBeNull();
    const originalPreflight = actions.preflight;
    const racedPreflight = vi.spyOn(actions, 'preflight').mockImplementationOnce(async (...args) => { const result = await originalPreflight(...args); watched = true; return result; });
    const runCount = module.actions.snapshot().runs.length;
    const raced = { ...input, attemptId: 'raced-attempt', sourcePath: 'CoForge/Automations/nudge-raced-attempt.md' };
    await expect(port.create(raced)).rejects.toThrow('watched inbox');
    expect(module.actions.snapshot().runs).toHaveLength(runCount);
    expect(kit.read(raced.sourcePath)).toContain(input.context);
    watched = false; racedPreflight.mockRestore();
    await module.actions.catalogue.save(defaultCouncilDefinition('workflow-council', 'Workflow Council', { ...entry.definition, members: ['reviewer'] }, ['reviewer']));
    const pausedPort = workflowAgentTasks(plugin, studio, module.actions);
    const councilBinding = await pausedPort.prepareCouncil!(projectId, 'workflow-council');
    const unavailablePort = workflowAgentTasks(plugin, studio, { ...module.actions, snapshot: () => ({ ...module.actions.snapshot(), executor: false }) });
    const unavailableInput = { ...input, councilId: 'workflow-council', councilBinding, teamId: '', agentId: '', attemptId: 'missing-executor', sourcePath: 'CoForge/Automations/nudge-missing-executor.md' };
    await expect(unavailablePort.create(unavailableInput)).rejects.toBeInstanceOf(AgentTaskNotStartedError);
    expect(app.vault.getAbstractFileByPath(unavailableInput.sourcePath)).toBeNull();
    const savedAgent = (await module.actions.catalogue.list()).valid.find(item => item.definition.id === 'reviewer')!;
    if (savedAgent.definition.schema !== 'agent/v1') throw new Error('Expected reviewer');
    await module.actions.catalogue.save({ ...savedAgent.definition, instructions: 'Changed after the workflow capture.' }, savedAgent.revision);
    const staleInput = { ...unavailableInput, attemptId: 'stale-council', sourcePath: 'CoForge/Automations/nudge-stale-council.md' };
    await expect(pausedPort.create(staleInput)).rejects.toBeInstanceOf(AgentTaskNotStartedError);
    expect(app.vault.getAbstractFileByPath(staleInput.sourcePath)).toBeNull();
    const changedAgent = (await module.actions.catalogue.list()).valid.find(item => item.definition.id === 'reviewer')!;
    await module.actions.catalogue.save(savedAgent.definition, changedAgent.revision);
    const savedPrompt = studio.state().settings.agentPrompt;
    await studio.updateSettings({ agentPrompt: 'A later project prompt.' });
    await expect(pausedPort.create(staleInput)).rejects.toBeInstanceOf(AgentTaskNotStartedError);
    expect(app.vault.getAbstractFileByPath(staleInput.sourcePath)).toBeNull();
    await studio.updateSettings({ agentPrompt: savedPrompt });
    const councilReceipt = await pausedPort.create({ ...input, councilId: 'workflow-council', councilBinding, teamId: '', agentId: '', attemptId: 'council-attempt', sourcePath: 'CoForge/Automations/nudge-council-attempt.md' });
    const child = module.actions.snapshot().runs.find(item => item.id === councilReceipt.runId)!;
    expect(child).toMatchObject({ state: 'queued', projectId, teamId: entry.definition.id, attempts: [] });
    expect(child.invocations).toHaveLength(2);
    expect(await pausedPort.result!(councilReceipt.runId)).toEqual({ state: 'pending' });
    expect(module.actions.snapshot().paused).toBe(true);
    const completedChild = structuredClone(child);
    completedChild.state = 'completed'; completedChild.cursor = child.invocations.length;
    completedChild.artifacts = child.invocations.map((invocation, index) => ({
      id: `answer-${index}`, runId: child.id, invocationId: invocation.id, attemptId: `attempt-${index}`,
      roundId: invocation.roundId, agentId: invocation.agentId, agentRevision: invocation.agentRevision,
      provider: invocation.provider, model: invocation.model, inputArtifactIds: [], createdAt: new Date().toISOString(),
      markdown: `Advice for ${invocation.roundId}`, simulated: false,
    })).reverse();
    completedChild.attempts = completedChild.artifacts.map(artifact => ({
      id: artifact.attemptId, invocationId: artifact.invocationId, status: 'published', startedAt: artifact.createdAt,
      dispatch: { prompt: 'Captured request', inputArtifactIds: [] }, artifactId: artifact.id,
    }));
    const cancelCompleted = vi.fn(async () => {});
    const completedPort = workflowAgentTasks(plugin, studio, { ...module.actions, cancel: cancelCompleted, snapshot: () => ({ ...module.actions.snapshot(), runs: [completedChild] }) });
    const answer = await completedPort.result!(child.id);
    expect(answer).toMatchObject({ state: 'completed', sourceId: councilReceipt.sourceId, projectId, markdown: expect.stringContaining('Reviewer · Opinions') });
    if (answer.state !== 'completed') throw new Error('Expected a published answer');
    expect(answer.markdown.indexOf('Opinions')).toBeLessThan(answer.markdown.indexOf('Solutions'));
    await completedPort.cancel!(child.id); expect(cancelCompleted).not.toHaveBeenCalled();
    completedChild.attempts[0]!.status = 'responded';
    expect(await completedPort.result!(child.id)).toEqual({ state: 'attention' });
    completedChild.attempts[0]!.status = 'published'; completedChild.artifacts[0]!.simulated = true;
    expect(await completedPort.result!(child.id)).toEqual({ state: 'attention' });
    const host = workflowTriggerHost(plugin, studio, actions, () => undefined);
    const idea = studio.state().ideas.find(idea => idea.status === 'inbox')!;
    const definition = { ...defaultWorkflowDefinition(studio.state().settings), revision: 'event-manual', steps: [{ id: 'review', name: 'Review', instructions: 'Human decides.', kind: 'approval' as const }] };
    await studio.saveWorkflow(projectId, definition, JSON.stringify(workflowDefinition(studio.state().settings)));
    const draft: WorkflowTriggerDraft = { name: 'Request review', enabled: true, event: 'request-created', scope: 'project', projectId, workflow: 'v1', workflowRevision: workflowDefinition(studio.state().settings).revision, request: 'event', cooldownSeconds: 1 };
    const event = { id: 'event-one', type: 'request-created', at: new Date().toISOString(), projectId, ideaId: idea.id };
    const occurrence: WorkflowTriggerOccurrence = { id: 'event-occurrence', bindingId: 'binding-one', bindingRevision: 1, event, snapshot: draft, status: 'reserved', reason: 'Reserved', at: Date.now(), definitionJson: (await host.describe(draft)).definitionJson };
    const origin = { rootEventId: event.id, bindingIds: ['binding-one'] };
    const first = await host.dispatch(draft, occurrence, origin, input.signal);
    expect(studio.state().ideas.find(item => item.id === idea.id)?.workflowRun).toMatchObject({ id: first.runId, state: 'waiting-human', automationEvent: { origin } });
    await new VaultProjects(plugin).save(studio.state().projects ?? []);
    await module.actions.workflows.save(projectId, { format: 'coforge-workflow/v2', revision: 'event-v2', name: 'Event review', subjectMode: 'note', teamId: entry.definition.id, limits: { ...input.limits, maxInvocations: 1 }, collections: [], steps: [{ id: 'review', name: 'Review event', kind: 'approval', instructions: 'Inspect the event.' }] });
    const v2 = { ...draft, workflow: 'v2' as const, workflowRevision: (await module.actions.workflows.load(projectId)).definition!.revision };
    const second = await host.dispatch(v2, { ...occurrence, id: 'v2-occurrence', snapshot: v2, definitionJson: (await host.describe(v2)).definitionJson }, origin, input.signal);
    expect(module.actions.snapshot().runs.find(run => run.id === second.runId)).toMatchObject({ projectId, automationEvent: { origin }, subject: { kind: 'note' } });
    expect(second.sourcePath && kit.read(second.sourcePath)).toContain('event-one');
    const originalWorkflowPreflight = actions.workflows.preflight;
    const racedWorkflowPreflight = vi.spyOn(actions.workflows, 'preflight').mockImplementationOnce(async (...args) => { const result = await originalWorkflowPreflight(...args); watched = true; return result; });
    const beforeRacedWorkflow = module.actions.snapshot().runs.length;
    await expect(host.dispatch(v2, { ...occurrence, id: 'raced-v2', snapshot: v2, definitionJson: (await host.describe(v2)).definitionJson }, origin, input.signal)).rejects.toThrow('watched inbox');
    expect(module.actions.snapshot().runs).toHaveLength(beforeRacedWorkflow);
    expect(kit.read('CoForge/Automations/raced-v2.md')).toContain('event-one');
    watched = false; racedWorkflowPreflight.mockRestore();
    await expect(host.dispatch(v2, { ...occurrence, definitionJson: '{}' }, origin, input.signal)).rejects.toThrow('changed');
    expect(kit.errors).toEqual([]);
  } finally { await module.dispose(); gate.dispose(); await studio.stop(); }
});
