// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref, toRaw } from 'vue';
import { expect, it } from 'vitest';
import WorkflowView from '../../../presentation/components/coforge/WorkflowView.vue';
import ConfiguredWorkflowExecution from '../../../presentation/components/coforge/ConfiguredWorkflowExecution.vue';
import WorkflowCapturedConfiguration from '../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue';
import { useWorkflow } from '../../../presentation/composables/coforge/use-workflow';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { defaultWorkflowDefinition, type WorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { createSeed } from '../../../features/coforge/domain/seed';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowUiFixture } from './workflow-ui-fixture';

it('keeps a single explicit-save draft across the workflow and template tabs', async () => {
  const f = await workflowUiFixture();
  f.store.openWorkflowTool('settings');
  const wrapper = mount(WorkflowView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const nav = wrapper.get('nav[aria-label="Agent workflow pages"]');
    expect(nav.findAll('button').map(button => button.text())).toEqual(['Idea Board Workflow', 'Step attempts', 'Answer / output templates', 'Herdr']);
    expect(wrapper.find('[aria-label="Request workflow execution"]').exists()).toBe(false);
    const editor = useWorkflowEditorStore(f.pinia);
    const session = editor.session;
    const saves = f.storage.saves;
    await wrapper.get('[data-workflow-field="name"]').setValue('Independent process draft');
    const capturedLimits = { ...editor.draft.limits };
    await nav.findAll('button').find(button => button.text() === 'Answer / output templates')!.trigger('click');
    expect(editor.session).toBe(session);
    await nav.findAll('button').find(button => button.text() === 'Idea Board Workflow')!.trigger('click');
    expect(wrapper.get('[data-workflow-field="name"]').element).toHaveProperty('value', 'Independent process draft');
    expect(editor.draft.limits).toEqual(capturedLimits);
    expect(f.storage.saves).toBe(saves);
    await nav.findAll('button').find(button => button.text() === 'Step attempts')!.trigger('click');
    expect(f.store.workflowTool).toBe('settings');
    expect(f.store.toasts.at(-1)?.message).toContain('Save or discard');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('binds execution strictly to its request and owning project instead of a global request fallback', async () => {
  const f = await workflowUiFixture();
  if (!f.store.state) throw new Error('Missing state');
  const owner = f.store.state.projects!.find(project => project.id === f.project.id)!;
  const definition: WorkflowDefinition = { ...defaultWorkflowDefinition(owner.settings), name: 'Owner process' };
  owner.settings.workflow = definition;
  const other = { ...structuredClone(toRaw(owner)), id: 'CFP-999', settings: { ...structuredClone(toRaw(owner.settings)), workflow: { ...structuredClone(definition), name: 'Other process' } } };
  f.store.state.projects!.push(other); f.store.state.activeProjectId = other.id; f.store.state.settings = other.settings;
  const base = createSeed().ideas[0]!;
  const first = { ...base, id: 'CF-501', title: 'Selected owner request', projectId: owner.id };
  const second = { ...base, id: 'CF-502', title: 'Other project request', projectId: other.id };
  f.store.state.ideas = [first, second]; f.store.workflowRequestSelection = second.id;
  const selected = ref<string | undefined>(first.id);
  let model: ReturnType<typeof useWorkflow> | undefined;
  const Probe = defineComponent({ setup() { model = useWorkflow(() => selected.value); return () => h(ConfiguredWorkflowExecution, { model: model! }); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.text()).toContain(first.title); expect(wrapper.text()).toContain('Owner process');
    expect(wrapper.text()).not.toContain(second.title); expect(wrapper.text()).not.toContain('Other process');
    expect(wrapper.find('[aria-label="Workflow request"]').exists()).toBe(false);
    f.store.state.jobs.push({ id: 'owned-job', ideaId: first.id, projectId: owner.id, stage: 'screen', provider: 'demo', status: 'queued', startedAt: new Date().toISOString(), logs: [] });
    await flushPromises();
    expect(model?.blocked).toContain('already queued or running');
    selected.value = 'missing-request'; await flushPromises();
    expect(model?.selected).toBeUndefined();
    expect(wrapper.text()).not.toContain(second.title);
    expect(f.store.state.activeProjectId).toBe(other.id);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps monitor errors and recovery consent apart by request and clears them when its binding changes', async () => {
  const f = await workflowUiFixture();
  const base = createSeed().ideas[0]!;
  f.store.state!.ideas = [{ ...base, id: 'CF-601', projectId: f.project.id }, { ...base, id: 'CF-602', projectId: f.project.id }];
  const selected = ref('CF-601');
  let first: ReturnType<typeof useWorkflow> | undefined; let second: ReturnType<typeof useWorkflow> | undefined;
  const Probe = defineComponent({ setup() { first = useWorkflow(() => selected.value); second = useWorkflow(() => 'CF-602'); return () => h('div'); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  try {
    first!.error = 'First request failure'; first!.nudgeRecoveryConsent = true;
    expect(second!.error).toBe(''); expect(second!.nudgeRecoveryConsent).toBe(false);
    selected.value = 'CF-602'; await flushPromises();
    expect(first!.error).toBe(''); expect(first!.nudgeRecoveryConsent).toBe(false);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('shows a captured CoWorker identity and persona entirely from the retained run', async () => {
  const f = await workflowUiFixture();
  const at = new Date().toISOString();
  const definition = defaultWorkflowDefinition(f.project.settings);
  const run: WorkflowRun = { id: 'run', ideaId: 'CF-501', projectId: f.project.id, definition, proposalRevision: 'proposal', revision: 1, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: at, updatedAt: at,
    coworkerBindings: [{ stepId: definition.steps[0]!.id, profile: { format: 'coforge-workflow-coworker/v1', id: 'reviewer', name: 'Captured reviewer', revision: 'original-revision', role: 'Review architecture', instructions: 'Keep the original boundaries.', provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' } }] };
  const wrapper = mount(WorkflowCapturedConfiguration, { props: { run }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const section = wrapper.get('[aria-label="Captured CoWorkers"]');
    expect(section.text()).toContain('Captured reviewer'); expect(section.text()).toContain('original-revision');
    expect(section.text()).toContain('Codex · gpt-6.1-sol · high effort');
    expect(section.text()).toContain('Keep the original boundaries.');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('opens the bound request owning-project definition when another project is active', async () => {
  const f = await workflowUiFixture();
  await f.studio.createIdea({ title: 'Owner configuration', description: 'Edit its own definition.', category: 'Gameplay', username: 'Owner' });
  const idea = f.studio.state().ideas[0]!;
  const other = await f.studio.createProject({ projectName: 'Other project', projectBrief: 'Keep unrelated settings independent.', projectPath: '/synthetic/other' });
  let model: ReturnType<typeof useWorkflow> | undefined;
  const Probe = defineComponent({ setup() { model = useWorkflow(() => idea.id); return () => h(ConfiguredWorkflowExecution, { model: model! }); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(f.store.activeProject?.id).toBe(other.id);
    model!.editWorkflow(); await flushPromises();
    expect(f.store.activeProject?.id).toBe(f.project.id);
    expect(f.store.view).toBe('workflow-settings');
    expect(f.store.workflowTool).toBe('settings');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('defers stale CoWorker provider readiness until capture while preserving access, votes and captured-run gates', async () => {
  const f = await workflowUiFixture();
  const owner = f.store.state!.projects!.find(item => item.id === f.project.id)!;
  owner.settings.workflow = defaultWorkflowDefinition(owner.settings);
  const step = owner.settings.workflow.steps[0]!;
  if (step.kind !== 'ai') throw new Error('Expected AI first step');
  step.coworkerId = 'fresh-profile'; step.provider = 'codex'; step.model = 'gpt-6.1-sol'; step.access = 'none';
  const idea = { ...createSeed().ideas[0]!, id: 'CF-900', projectId: owner.id, voters: [] };
  f.store.state!.ideas = [idea];
  f.store.state!.runtime = { ...f.store.state!.runtime!, cliAvailable: false, projectPath: null, allowImplementation: false, codexAvailable: false };
  let model: ReturnType<typeof useWorkflow> | undefined;
  const Probe = defineComponent({ setup() { model = useWorkflow(() => idea.id); return () => h(ConfiguredWorkflowExecution, { model: model! }); } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(model!.canRunNext).toBe(true);
    step.minVotes = 2; await flushPromises(); expect(model!.blocked).toContain('Needs 2 votes');
    step.minVotes = 0; step.access = 'editworktree'; owner.allowImplementation = false;
    await flushPromises(); expect(model!.blocked).toContain('Enable real implementation');
    step.access = 'none'; delete step.coworkerId;
    await flushPromises(); expect(model!.blocked).toContain('Codex CLI is not detected');
    step.coworkerId = 'fresh-profile';
    const at = new Date().toISOString();
    f.store.state!.ideas[0]!.workflowRun = { id: 'captured-provider', ideaId: idea.id, projectId: owner.id, definition: structuredClone(toRaw(owner.settings.workflow)), proposalRevision: 'proposal', revision: 1, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: at, updatedAt: at };
    await flushPromises(); expect(model!.blocked).toContain('Codex CLI is not detected');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
