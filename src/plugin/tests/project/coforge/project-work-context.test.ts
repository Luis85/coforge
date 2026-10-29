import { describe, expect, it } from 'vitest';
import { createSeed, defaultIntegration } from '../../../features/coforge/domain/seed';
import { initialProject } from '../../../features/coforge/domain/projects';
import { projectWorkSummary } from '../../../presentation/composables/coforge/project-work-summary';

function fixture() {
  const state = createSeed();
  const project = initialProject(state.settings, defaultIntegration(), new Date().toISOString());
  state.projects = [project];
  state.activeProjectId = project.id;
  state.ideas = state.ideas.map(idea => ({ ...idea, projectId: project.id }));
  return state;
}

describe('project workspace decision summary', () => {
  it('counts stages from the selected project and keeps other project requests out', () => {
    const state = fixture();
    const project = state.projects?.[0];
    const idea = state.ideas[0];
    if (!project || !idea) throw new Error('Missing project fixture');
    state.activeProjectId = project.id;
    state.ideas = [
      { ...idea, id: 'CF-901', projectId: project.id, status: 'review' },
      { ...idea, id: 'CF-902', projectId: project.id, status: 'flagged' },
      { ...idea, id: 'CF-903', projectId: project.id, status: 'inbox' },
      { ...idea, id: 'CF-904', projectId: project.id, status: 'shipped' },
      { ...idea, id: 'CF-905', projectId: 'CFP-OTHER', status: 'review' },
    ];
    expect(projectWorkSummary(state)).toMatchObject({
      id: project.id, name: project.settings.projectName,
      requests: 4, review: 1, flagged: 1, inbox: 1, accepted: 1,
    });
  });

  it('does not invent a project or zero-valued report while state is unavailable', () => {
    expect(projectWorkSummary(null)).toBeNull();
    const state = fixture();
    state.activeProjectId = 'CFP-MISSING';
    expect(projectWorkSummary(state)).toBeNull();
  });

  it('counts request states independently of queued and failed attempt history', () => {
    const state = fixture();
    const expected = state.ideas.filter(idea => idea.projectId === state.activeProjectId && idea.status === 'review').length;
    const summary = projectWorkSummary(state);
    expect(summary?.review).toBe(expected);
    expect(summary?.accepted).toBe(state.ideas.filter(idea => idea.projectId === state.activeProjectId && idea.status === 'shipped').length);
  });
});
