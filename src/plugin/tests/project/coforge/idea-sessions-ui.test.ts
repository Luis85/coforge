// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import IdeaCard from '../../../presentation/components/coforge/IdeaCard.vue';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import { createSeed } from '../../../features/coforge/domain/seed';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import type { AgentJob } from '../../../features/coforge/domain/types';
import { workflowUiFixture } from './workflow-ui-fixture';

const at = '2026-11-01T12:00:00Z';
const menuStub = { inheritAttrs: false, template: '<slot />' };
async function fixture() {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas.find(idea => idea.increment)!, projectId: f.project.id, status: 'review' as const };
  let trace = appendAgentSessionEvent(undefined, { kind: 'session', sessionId: 'root', label: 'Coordinator', status: 'running' }, at);
  trace = appendAgentSessionEvent(trace, { kind: 'message', sessionId: 'root', text: '<script>untrusted literal</script>' }, at);
  trace = appendAgentSessionEvent(trace, { kind: 'session', sessionId: 'native-child', parentSessionId: 'root', label: 'Technical review', status: 'running' }, at);
  trace = appendAgentSessionEvent(trace, { kind: 'tool', sessionId: 'native-child', tool: 'coforge_read_file', status: 'completed' }, at);
  const job: AgentJob = { id: 'parent-attempt', ideaId: idea.id, projectId: f.project.id, provider: 'codex', model: 'gpt-6.1-sol', stage: 'implement', status: 'running', startedAt: at, logs: ['Private diagnostics are not the public session feed'], sessionTrace: trace };
  f.store.state!.ideas = [idea]; f.store.state!.jobs = [job, { ...job, id: 'foreign', projectId: 'CFP-999', sessionTrace: undefined }];
  return { ...f, idea, job };
}

it('opens the private card Sessions view with parent running count, literal Peek and only observed native children', async () => {
  const f = await fixture();
  const card = mount(IdeaCard, { props: { idea: f.idea }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true, UContextMenu: menuStub, UDropdownMenu: menuStub } } });
  try {
    const sessions = card.get('.cf-card-sessions button');
    expect(sessions.attributes('aria-label')).toBe(`Sessions 1 parent running for ${f.idea.id}`);
    expect(sessions.text()).toContain('1 parent running');
    await sessions.trigger('click');
    expect(f.store.drawerTab).toBe('sessions');
    const drawer = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
    try {
      expect(drawer.get('[aria-label="Idea sections"]').findAll('button').map(button => button.text())).toEqual(['Overview', 'Sessions', 'Plan & Design', 'Increment', 'Workflow runs', 'Activity']);
      const peek = drawer.get('[aria-label="Session Peek"]');
      expect(peek.text()).toContain('<script>untrusted literal</script>');
      expect(peek.find('script').exists()).toBe(false);
      expect(drawer.get('[aria-label="Parent sessions"]').text()).toContain('Technical review');
      expect(drawer.text()).not.toContain('Private diagnostics are not the public session feed');
      expect(drawer.findAll('button').some(button => /Cancel run|Accept increment|Request changes|Start ·|Record operator acknowledgement/u.test(button.text()))).toBe(false);
      expect(peek.find('input, textarea').exists()).toBe(false);
      expect(f.runner).not.toHaveBeenCalled();
    } finally { drawer.unmount(); }
  } finally { card.unmount(); await f.dispose(); }
});

it('uses the optional native read-only terminal capability for the parent feed even when peeking at a child', async () => {
  const f = await fixture(); const open = vi.fn(async () => {}); f.context.host.sessionFollow = { open };
  f.store.select(f.idea.id, 'sessions');
  const drawer = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    await drawer.get('[data-native-session-id="native-child"]').trigger('click');
    await drawer.get('button[aria-label="Follow parent session in read-only terminal"]').trigger('click');
    await flushPromises(); expect(open).toHaveBeenCalledWith('parent-attempt');
    expect(drawer.get('[aria-label="Session Peek"]').text()).toContain('coforge_read_file');
    expect(drawer.get('[aria-label="Session Peek"]').text()).not.toContain('untrusted literal');
    expect(f.runner).not.toHaveBeenCalled();
    f.store.state!.activeProjectId = 'CFP-999'; await flushPromises();
    expect(f.store.selected).toBeNull();
  } finally { drawer.unmount(); await f.dispose(); }
});

it('keeps legacy, simulated and externally driven attempts visible without inventing capture or child sessions', async () => {
  const f = await fixture();
  f.store.state!.jobs = ['demo', 'mcp', 'herdr', 'claude'].map((provider, index) => ({ ...f.job, id: `legacy-${index}`, provider: provider === 'demo' ? 'demo' : provider === 'mcp' ? 'mcp' : provider === 'herdr' ? 'herdr' : 'claude', status: 'succeeded', sessionTrace: undefined }));
  f.store.select(f.idea.id, 'sessions');
  const drawer = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(drawer.get('[aria-label="Parent sessions"]').findAll('[data-parent-session-id]')).toHaveLength(4);
    expect(drawer.text()).toContain('No detailed session capture');
    expect(drawer.findAll('[data-native-session-id]')).toHaveLength(0);
    expect(drawer.find('button[aria-label="Follow parent session in read-only terminal"]').exists()).toBe(false);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { drawer.unmount(); await f.dispose(); }
});

it('restores card focus on Escape and disposes the elapsed timer on closing Sessions', async () => {
  const f = await fixture(); const clear = vi.spyOn(window, 'clearInterval'); const set = vi.spyOn(window, 'setInterval');
  const card = mount(IdeaCard, { props: { idea: f.idea }, attachTo: document.body, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true, UContextMenu: menuStub, UDropdownMenu: menuStub } } });
  let drawer: ReturnType<typeof mount> | undefined;
  try {
    const button = card.get('.cf-card-sessions button').element;
    if (!(button instanceof HTMLElement)) throw new Error('Missing Sessions button');
    button.focus(); await card.get('.cf-card-sessions button').trigger('click');
    drawer = mount(IdeaDrawer, { attachTo: document.body, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
    await flushPromises();
    expect(set).toHaveBeenCalled(); const timer = set.mock.results.at(-1)?.value;
    await drawer.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(f.store.selected).toBeNull(); drawer.unmount(); drawer = undefined;
    expect(document.activeElement).toBe(button); expect(clear).toHaveBeenCalledWith(timer);
  } finally { drawer?.unmount(); card.unmount(); clear.mockRestore(); set.mockRestore(); await f.dispose(); }
});
