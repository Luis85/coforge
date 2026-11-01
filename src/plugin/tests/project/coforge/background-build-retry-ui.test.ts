// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaWorkflowTab from '../../../presentation/components/coforge/IdeaWorkflowTab.vue';
import { retryUiApproval, retryUiFixture } from './background-build-retry-ui-fixture';

const button = (wrapper: VueWrapper, label: string) => {
  const found = wrapper.findAll('button').find(item => item.text() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
};
async function open(wrapper: VueWrapper) {
  await button(wrapper, 'Retry Build in background').trigger('click'); await flushPromises();
  return wrapper.get('[aria-label="Review background Build retry"]');
}
async function acknowledge(wrapper: VueWrapper) {
  await wrapper.get('[aria-label="I inspected earlier Build executors and confirmed they stopped"]').setValue(true);
  await wrapper.get('[aria-label="I reviewed this Build snapshot"]').setValue(true);
}

it('previews actual partial changes and captured settings without dispatch; requires both acknowledgements for the exact receipt', async () => {
  const f = await retryUiFixture();
  f.preview.inspection.captureScope = 'coforge-source-code/v1';
  f.preview.inspection.excludedPaths = [{ path: 'node_modules', reason: 'git-ignored-agent-denied-directory' }];
  const current = f.store.state!.projects!.find(item => item.id === f.project.id)!.settings.workflow!.steps[1]!;
  if (current.kind !== 'ai') throw new Error('Missing saved Build'); current.model = 'opus';
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, attachTo: document.body, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const earlier = JSON.stringify(f.run);
    const panel = await open(wrapper);
    const scope = panel.get('[aria-label="Reviewed snapshot capture scope"]');
    expect(scope.text()).toContain('node_modules'); expect(scope.text()).toContain('not transferred'); expect(scope.text()).toContain('allowed manual files');
    expect(f.inspect).toHaveBeenCalledExactlyOnceWith(f.idea.id); expect(f.confirm).not.toHaveBeenCalled();
    for (const text of ['actual reviewed partial code', 'sonnet', 'high', 'Keep the captured implementation task.', '12', 'USD1', 'No elapsed deadline', 'original workspace']) expect(panel.text()).toContain(text);
    const confirm = button(wrapper, 'Confirm background retry');
    expect(confirm.attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="I inspected earlier Build executors and confirmed they stopped"]').setValue(true);
    expect(confirm.attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="I reviewed this Build snapshot"]').setValue(true);
    expect(confirm.attributes('disabled')).toBeUndefined();
    expect(JSON.stringify(f.run)).toBe(earlier); expect(f.runner).not.toHaveBeenCalled();
    expect(panel.text()).not.toContain('opus');
    await confirm.trigger('click'); await flushPromises();
    expect(f.confirm).toHaveBeenCalledExactlyOnceWith(f.idea.id, f.preview.id, { oldExecutorStopped: true, changesReviewed: true, releaseStopHold: false });
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps later retries behind reviewed background admission and displays its separate immutable approval', async () => {
  const f = await retryUiFixture();
  f.store.state!.runtime.cliAvailable = true; f.store.state!.runtime.projectPath = f.project.projectPath; f.store.state!.runtime.allowImplementation = true;
  f.store.state!.projects!.find(item => item.id === f.project.id)!.allowImplementation = true;
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.findAll('button').some(item => item.text() === 'Continue · Captured Build')).toBe(true);
    f.run.backgroundRetries = [retryUiApproval(f.preview)]; await flushPromises();
    expect(wrapper.findAll('button').some(item => item.text() === 'Continue · Captured Build')).toBe(false);
    expect(button(wrapper, 'Retry Build in background').exists()).toBe(true);
    const history = wrapper.get('[aria-label="Approved background Build retries"]');
    expect(history.text()).toContain(f.preview.inspection.snapshot.contentHash);
    expect(history.text()).toContain('No elapsed deadline'); expect(history.text()).toContain('12');
    expect(f.run.definition.steps[1]).not.toHaveProperty('execution');
    expect(f.confirm).not.toHaveBeenCalled(); expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('rejects another request’s receipt and suppresses double confirmation while the original admission is pending', async () => {
  const f = await retryUiFixture();
  f.inspect.mockResolvedValueOnce({ ...f.preview, ideaId: 'CF-other' });
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await button(wrapper, 'Retry Build in background').trigger('click'); await flushPromises();
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false); expect(f.confirm).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('earlier request, run or policy');
    await open(wrapper); await acknowledge(wrapper);
    let finish: (() => void) | undefined;
    f.confirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const confirm = button(wrapper, 'Confirm background retry'); await confirm.trigger('click'); await confirm.trigger('click');
    expect(f.confirm).toHaveBeenCalledTimes(1); finish!(); await flushPromises();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('requires separate explicit Stop-hold release and never invents an executor for a reviewed clean repository', async () => {
  const f = await retryUiFixture(); f.preview.stopHold = true; f.store.state!.workflowStopHolds = [f.idea.id];
  f.preview.inspection.sourceKind = 'repository'; f.preview.source.sourceKind = 'repository';
  delete f.preview.inspection.sourceWorkspaceId; delete f.preview.source.sourceWorkspaceId;
  delete f.preview.source.sourceAttemptId; delete f.preview.source.sourceJobId;
  f.preview.inspection.increment = null; f.preview.inspection.fileCount = 0; f.preview.inspection.humanCessationRequired = false;
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    const panel = await open(wrapper);
    expect(panel.text()).toContain('No earlier Build executor'); expect(panel.text()).toContain('clean repository');
    expect(wrapper.find('[aria-label="I inspected earlier Build executors and confirmed they stopped"]').exists()).toBe(false);
    await wrapper.get('[aria-label="I reviewed this Build snapshot"]').setValue(true);
    const confirm = button(wrapper, 'Release Stop hold and confirm background retry'); expect(confirm.attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="Release this request’s Stop hold for this retry"]').setValue(true);
    await confirm.trigger('click'); await flushPromises();
    expect(f.confirm).toHaveBeenCalledExactlyOnceWith(f.idea.id, f.preview.id, { oldExecutorStopped: false, changesReviewed: true, releaseStopHold: true });
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('invalidates reviewed consent on source policy/run changes and keeps failed confirmation behind a fresh preview', async () => {
  const f = await retryUiFixture();
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await open(wrapper); await acknowledge(wrapper);
    f.store.state!.projects!.find(item => item.id === f.project.id)!.settings.workflow!.revision = 'changed-saved-policy';
    await flushPromises();
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false); expect(f.confirm).not.toHaveBeenCalled();
    f.preview.policySource.definitionRevision = 'changed-saved-policy';
    await open(wrapper); await acknowledge(wrapper);
    f.confirm.mockRejectedValueOnce(new Error('The workspace snapshot changed. Preview again.'));
    await button(wrapper, 'Confirm background retry').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('workspace snapshot changed');
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false);
    await open(wrapper); expect(button(wrapper, 'Confirm background retry').attributes('disabled')).toBeDefined();
    f.run.revision++; await flushPromises();
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false);
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('discards a preview arriving after its request/run changed, keeps worker-unready preview blocked, and closes only the local panel on Escape', async () => {
  const f = await retryUiFixture(); let resolvePreview: ((value: typeof f.preview) => void) | undefined;
  f.inspect.mockImplementationOnce(() => new Promise(resolve => { resolvePreview = resolve; }));
  const wrapper = mount(IdeaWorkflowTab, { props: { idea: f.idea }, attachTo: document.body, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await button(wrapper, 'Retry Build in background').trigger('click'); f.run.revision++; await flushPromises();
    resolvePreview!(f.preview); await flushPromises();
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false);
    f.preview.runRevision = f.run.revision; f.preview.source.runRevision = f.run.revision;
    f.preview.readiness.ready = false; f.preview.readiness.message = 'Configure the worker Node runtime.';
    const panel = await open(wrapper); await acknowledge(wrapper);
    expect(panel.text()).toContain('Configure the worker Node runtime.'); expect(button(wrapper, 'Confirm background retry').attributes('disabled')).toBeDefined();
    await panel.trigger('keydown', { key: 'Escape' }); await flushPromises();
    expect(wrapper.find('[aria-label="Review background Build retry"]').exists()).toBe(false);
    expect(document.activeElement).toBe(button(wrapper, 'Retry Build in background').element); expect(f.confirm).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
