import { expect, it } from 'vitest';
import { workflowUiFixture } from './workflow-ui-fixture';
import { parseProjectNote, projectProperties } from '../../../features/coforge/domain/project-note';
import { projectConfigurationIdentity } from '../../../features/coforge/domain/projects';

it('saves independent project group choices, including none, and round trips canonical properties', async () => {
  const fixture = await workflowUiFixture();
  try {
    const other = await fixture.studio.createProject({ projectName: 'Other project', projectBrief: 'Another independent workspace.', projectPath: '/synthetic/other' });
    const saved = await fixture.studio.updateProject({ featureGroups: ['build', 'insights'] }, fixture.project.id);
    expect(projectProperties(saved)['coforge-feature-groups']).toEqual(['build', 'insights']);
    expect(projectProperties(parseProjectNote(projectProperties(saved))!)['coforge-feature-groups']).toEqual(['build', 'insights']);
    await fixture.studio.selectProject(fixture.project.id);
    await fixture.studio.selectProject(other.id);
    expect(projectProperties(fixture.studio.state().projects!.find(project => project.id === fixture.project.id)!)['coforge-feature-groups']).toEqual(['build', 'insights']);
    const empty = await fixture.studio.updateProject({ featureGroups: [] }, other.id);
    expect(projectProperties(parseProjectNote(projectProperties(empty))!)['coforge-feature-groups']).toEqual([]);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { await fixture.dispose(); }
});

it('keeps committed choices on invalid input, stale configuration and storage failure', async () => {
  const fixture = await workflowUiFixture();
  try {
    const identity = projectConfigurationIdentity(fixture.project);
    await fixture.studio.updateProject({ featureGroups: ['build'] });
    const before = fixture.studio.state();
    await expect(fixture.studio.updateProject({ featureGroups: ['unknown'] })).rejects.toThrow();
    await expect(fixture.studio.updateProject({ featureGroups: [] }, fixture.project.id, identity)).rejects.toThrow('changed outside');
    fixture.storage.failNextSave = true;
    await expect(fixture.studio.updateProject({ featureGroups: [] })).rejects.toThrow('Disk full');
    expect(fixture.studio.state()).toEqual(before);
    for (const value of [null, 'stream', ['unknown'], [true]]) {
      expect(() => parseProjectNote({ ...projectProperties(fixture.project), 'coforge-feature-groups': value })).toThrow();
    }
  } finally { await fixture.dispose(); }
});

it('allows workspace changes during an active run without stopping or reconfiguring it', async () => {
  const fixture = await workflowUiFixture();
  let finish: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  fixture.runner.mockImplementationOnce(async () => {
    await pending;
    return { screening: { verdict: 'clear', reason: 'Reviewed fixture', signals: [], checkedAt: new Date().toISOString(), provider: 'demo' } };
  });
  try {
    await fixture.studio.createIdea({ title: 'Keep processing this request', description: 'Visibility does not change background work.', category: 'Gameplay', username: 'Owner' });
    const idea = fixture.studio.state().ideas[0]!;
    await fixture.studio.act(idea.id, 'screen');
    await expect.poll(() => fixture.runner.mock.calls.length).toBe(1);
    const before = fixture.studio.state();
    await fixture.studio.updateProject({ featureGroups: [] });
    expect(fixture.studio.state().jobs).toEqual(before.jobs);
    expect(fixture.studio.state().runtime).toEqual(before.runtime);
    await expect(fixture.studio.updateProject({ featureGroups: [], agentPrompt: 'Change running configuration' })).rejects.toThrow();
    finish?.(); await fixture.studio.engine.waitUntilIdle();
    expect(fixture.studio.state().ideas.find(item => item.id === idea.id)?.status).toBe('screened');
    expect(fixture.runner).toHaveBeenCalledTimes(1);
  } finally { finish?.(); await fixture.dispose(); }
});
