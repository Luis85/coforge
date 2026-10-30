import { expect, it } from 'vitest';
import { workflowUiFixture } from './workflow-ui-fixture';
import { OPTIONAL_PROJECT_FEATURES } from './optional-project-features-fixture';
import { parseProjectNote, projectProperties } from '../../../features/coforge/domain/project-note';
import { projectConfigurationIdentity } from '../../../features/coforge/domain/projects';
import { studioViewEnabled, STUDIO_DESTINATIONS } from '../../../presentation/stores/studio-destinations';

it.each(OPTIONAL_PROJECT_FEATURES)('selects %s independently and keeps essential navigation', async (id, _label, group) => {
  const fixture = await workflowUiFixture();
  try {
    const saved = await fixture.studio.updateProject({ features: [id] });
    expect(projectProperties(saved)['coforge-features']).toEqual([id]);
    expect(projectProperties(parseProjectNote(projectProperties(saved))!)['coforge-features']).toEqual([id]);
    for (const [view] of OPTIONAL_PROJECT_FEATURES) expect(studioViewEnabled(view, saved)).toBe(view === id);
    expect(studioViewEnabled('workflow-settings', saved)).toBe(id === 'workflow');
    expect(studioViewEnabled('settings', saved)).toBe(true);
    expect(studioViewEnabled('projects', saved)).toBe(true);
    expect(STUDIO_DESTINATIONS[id].group).toBe(group);
    const hidden = await fixture.studio.updateProject({ featureGroups: [] });
    expect(studioViewEnabled(id, hidden)).toBe(false);
    await fixture.studio.updateProject({ featureGroups: [group] });
    expect(studioViewEnabled(id, fixture.studio.state().projects![0])).toBe(true);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { await fixture.dispose(); }
});

it('rejects invalid/stale/failed feature writes without changing committed choices', async () => {
  const fixture = await workflowUiFixture();
  try {
    const original = projectConfigurationIdentity(fixture.project);
    await fixture.studio.updateProject({ features: ['service-design'] });
    const before = fixture.studio.state();
    for (const features of [null, 'service-design', ['unknown'], [true]]) {
      await expect(fixture.studio.updateProject({ features })).rejects.toThrow();
      expect(() => parseProjectNote({ ...projectProperties(fixture.project), 'coforge-features': features })).toThrow();
    }
    await expect(fixture.studio.updateProject({ features: [] }, fixture.project.id, original)).rejects.toThrow('changed outside');
    fixture.storage.failNextSave = true;
    await expect(fixture.studio.updateProject({ features: [] })).rejects.toThrow('Disk full');
    expect(fixture.studio.state()).toEqual(before);
  } finally { await fixture.dispose(); }
});

it('covers every studio capability except essential settings/projects and the workflow alias', () => {
  const listed = OPTIONAL_PROJECT_FEATURES.map(([id]) => id);
  expect(Object.keys(STUDIO_DESTINATIONS).filter(id => !['settings', 'projects', 'workflow-settings'].includes(id)).sort()).toEqual([...listed].sort());
});
