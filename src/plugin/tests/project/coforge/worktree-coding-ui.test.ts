// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import type { AgentJob } from '../../../features/coforge/domain/types';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { createSeed } from '../../../features/coforge/domain/seed';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import WorkflowEditorView from '../../../presentation/components/coforge/WorkflowEditorView.vue';
import WorkflowCapturedConfiguration from '../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { useWorkflowEditorStore } from '../../../presentation/stores/coforge-workflow-editor';
import { configuredStepProblem } from '../../../presentation/composables/coforge/configured-workflow-display';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

it('presents ordinary native coding and its assistant limit without a Docker setup recipe or modifying saved instructions/legacy selections', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia);
    const build = editor.draft.steps.find(step => step.kind === 'ai' && step.output === 'codechange');
    if (!build || build.kind !== 'ai') throw new Error('Missing Build fixture.');
    build.provider = 'claude'; build.nativeTools = { verification: { commandIds: ['retained-old-check'] } }; editor.selectedId = build.id;
    const instructions = build.instructions; await flushPromises();
    const coding = wrapper.get('[aria-label="Native worktree coding"]');
    expect(coding.text()).toContain('normal file tools, shell, project tests');
    expect(coding.text()).toContain('Internet research is allowed');
    expect(coding.text()).toContain('available provider web tools');
    expect(coding.text()).toContain('network-enabled shell commands');
    expect(coding.text()).toContain('not an operating-system sandbox'); expect(coding.text()).toContain('current desktop account');
    expect(coding.text()).not.toContain('Enable isolated workflow verification');
    expect(coding.find('[aria-label="Allow provider-native assistants"]').exists()).toBe(false);
    await coding.get('[aria-label="Maximum concurrent native assistants"]').setValue(3);
    expect(build.nativeTools.delegation?.maxConcurrent).toBe(3);
    expect(build.nativeTools.verification?.commandIds).toEqual(['retained-old-check']); expect(build.instructions).toBe(instructions);
    expect(f.studio.integration().workflowVerification).toBeUndefined(); expect(f.runner).not.toHaveBeenCalled();
    const project = { ...f.project, allowImplementation: true };
    expect(configuredStepProblem(build, project, { ...f.store.state!.runtime, cliAvailable: true, codexAvailable: true })).toBe('');
    build.provider = 'codex'; build.execution = { mode: 'background', idleWarningSeconds: 1800 };
    await wrapper.get('form.cf-workflow-editor').trigger('submit'); await flushPromises();
    expect(wrapper.get('.cf-workflow-editor-notice').text()).toContain('Workflow saved');
    const saved = f.studio.state().projects?.find(project => project.id === f.project.id)?.settings.workflow?.steps.find(step => step.id === build.id);
    expect(saved?.kind === 'ai' && saved.execution?.maxRuntimeSeconds).toBeUndefined();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps classification and read-only analysis restricted instead of implying normal coding permissions', async () => {
  const f = await workflowUiFixture();
  const wrapper = mount(WorkflowEditorView, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const editor = useWorkflowEditorStore(f.pinia); const step = editor.draft.steps.find(step => step.kind === 'ai');
    if (!step || step.kind !== 'ai') throw new Error('Missing analysis fixture.');
    step.provider = 'claude'; step.access = 'none'; editor.selectedId = step.id; await flushPromises();
    expect(wrapper.find('[aria-label="Native worktree coding"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Allow provider-native assistants"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Internet research is allowed');
    expect(wrapper.text()).toContain('restricted'); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('shows exact per-attempt native/MCP profiles and leaves missing markers legacy despite identical current step definitions', async () => {
  const f = await workflowUiFixture(); const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  const step = { ...ai('build', 'codechange', 'editworktree'), provider: 'claude' as const };
  const at = '2026-11-01T15:00:00Z';
  const run: WorkflowRun = { id: 'captured-run', ideaId: idea.id, projectId: f.project.id, definition: definition([step]), proposalRevision: 'proposal',
    revision: 1, cursor: 0, state: 'attention', createdAt: at, updatedAt: at, artifacts: [], attempts: ['native','mcp','legacy'].map(id => ({
      id: `attempt-${id}`, jobId: `job-${id}`, stepId: step.id, stepName: 'Captured Build', kind: 'ai', status: 'failed', inputs: [], startedAt: at })) };
  const job = (id: string): AgentJob => ({ id: `job-${id}`, ideaId: idea.id, projectId: f.project.id, provider: 'claude', model: 'captured-model', stage: 'implement',
    status: 'failed', startedAt: at, logs: [], workflow: { runId: run.id, attemptId: `attempt-${id}`, definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision, step, inputArtifacts: [] } });
  const native = job('native'); native.workflow!.worktreeCoding = { version: 1, profile: 'native-worktree-v1', maxConcurrent: 3 };
  const mcp = job('mcp'); mcp.provider = 'mcp'; mcp.workflow!.worktreeCoding = { version: 1, profile: 'mcp-worktree-v1' };
  f.store.state!.ideas = [{ ...idea, workflowRun: run }]; f.store.state!.jobs = [native, mcp, job('legacy')];
  const wrapper = mount(WorkflowCapturedConfiguration, { props: { run }, global: { plugins: [f.pinia, f.provider] } });
  try {
    const profiles = wrapper.get('[aria-label="Captured attempt coding profiles"]');
    expect(profiles.text()).toContain('native-worktree-v1'); expect(profiles.text()).toContain('3 concurrent');
    expect(profiles.text()).toContain('mcp-worktree-v1'); expect(profiles.text()).toContain('External MCP client');
    expect(profiles.text()).toContain('Legacy scoped tools');
    const nativeProfile = profiles.get('[data-coding-profile="native-worktree-v1"]');
    expect(nativeProfile.text()).toContain('Internet research is allowed');
    expect(nativeProfile.text()).toContain('provider and network restrictions still apply');
    const mcpProfile = profiles.get('[data-coding-profile="mcp-worktree-v1"]');
    expect(mcpProfile.text()).toContain('Internet research is allowed');
    expect(mcpProfile.text()).toContain('normal desktop connectivity');
    expect(mcpProfile.text()).toContain('client controls its own web tools');
    expect(profiles.get('[data-coding-profile="legacy"]').text()).not.toContain('Internet research is allowed');
    expect(profiles.findAll('[data-coding-profile="mcp-worktree-v1"]').at(0)?.text()).not.toContain('concurrent');
    f.store.state!.projects![0]!.allowImplementation = false; await flushPromises();
    expect(profiles.text()).toContain('native-worktree-v1'); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('attributes captured native coding permissions and provider tool observations without claiming Docker execution or a current-source test pass', async () => {
  const f = await workflowUiFixture(); const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  const step = { ...ai('build', 'codechange', 'editworktree'), provider: 'codex' as const };
  const at = '2026-11-01T15:00:00Z';
  const job: AgentJob = { id: 'native-job', ideaId: idea.id, projectId: f.project.id, provider: 'codex', model: 'captured-model', stage: 'implement', status: 'succeeded',
    startedAt: at, logs: [], workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'v1', proposalRevision: 'proposal', step, inputArtifacts: [],
      worktreeCoding: { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 } } };
  f.store.state!.ideas = [idea]; f.store.state!.jobs = [job]; f.store.select(idea.id, 'activity');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const policy = wrapper.get('[aria-label="Captured native tool policy"]');
    expect(policy.text()).toContain('native-worktree-v1'); expect(policy.text()).toContain('normal file tools, shell, project tests');
    expect(policy.text()).not.toContain('isolated verification permitted');
    await wrapper.findAll('[aria-label="Idea sections"] button').find(button => button.text() === 'Sessions')!.trigger('click');
    expect(wrapper.get('[aria-label="Session Peek"]').text()).toContain('Provider-observed');
    expect(wrapper.get('[aria-label="Session Peek"]').text()).toContain('Internet research is allowed');
    expect(wrapper.get('[aria-label="Session Peek"]').text()).toContain('not a passing test result');
    expect(wrapper.find('[aria-label="Observed verification commands"]').exists()).toBe(false); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('shows host MCP observations only for the admitted MCP coding profile without fabricating SDK assistants or a client model', async () => {
  const f = await workflowUiFixture(); const idea = { ...createSeed().ideas[0]!, projectId: f.project.id };
  const step = { ...ai('build', 'codechange', 'editworktree'), provider: 'claude' as const, nativeTools: { delegation: { maxConcurrent: 3 } } }; const at = '2026-11-01T15:00:00Z';
  const job: AgentJob = { id: 'mcp-job', ideaId: idea.id, projectId: f.project.id, provider: 'mcp', stage: 'implement', status: 'succeeded', startedAt: at, logs: [],
    workflow: { runId: 'mcp-run', attemptId: 'mcp-attempt', definitionRevision: 'v1', proposalRevision: 'proposal', step, inputArtifacts: [], worktreeCoding: { version: 1, profile: 'mcp-worktree-v1' } },
    sessionTrace: appendAgentSessionEvent(undefined, { kind: 'tool', tool: 'coforge_run_command', status: 'completed', text: 'Host observed command exit 0; fixture output.' }, at) };
  f.store.state!.ideas = [idea]; f.store.state!.jobs = [job]; f.store.select(idea.id, 'sessions');
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const peek = wrapper.get('[aria-label="Session Peek"]');
    expect(peek.text()).toContain('Host-observed MCP command events'); expect(peek.text()).toContain('fixture output');
    expect(peek.text()).toContain('not a test verdict');
    expect(peek.text()).toContain('Internet research is allowed');
    expect(wrapper.get('[aria-label="Parent sessions"]').text()).toContain('Client model not reported');
    expect(wrapper.find('[aria-label="Observed native assistants"]').exists()).toBe(false);
    expect(peek.text()).not.toContain('Permission to delegate');
    expect(peek.find('[aria-label="Follow parent session in read-only terminal"]').exists()).toBe(false);
    f.store.state!.jobs[0]!.workflow!.worktreeCoding = undefined; await flushPromises();
    expect(peek.text()).not.toContain('fixture output'); expect(peek.text()).toContain('Detailed session visibility is unavailable');
    expect(peek.text()).not.toContain('Internet research is allowed');
  } finally { wrapper.unmount(); await f.dispose(); }
});
