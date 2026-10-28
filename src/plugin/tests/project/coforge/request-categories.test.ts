import { expect, it } from 'vitest';
import { workflowUiFixture } from './workflow-ui-fixture';
import { requestObjectDefinitionCheck, REQUEST_OBJECT_FORMAT, requestObjectRevision } from '../../../features/coforge/domain/request-object';
import { ideaProperties, parseIdeaNote, ideaBody } from '../../../features/coforge/domain/idea-note';
import { stageInput } from '../../../features/coforge/application/agent-prompts';
import { publicExportBoardCheck } from '../../../infrastructure/coforge/public-export-board-check';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { createSeed } from '../../../features/coforge/domain/seed';

const schema = { format: REQUEST_OBJECT_FORMAT, className: 'Business Idea', fields: [], categories: ['Strategy', 'Commercial'] };
it('validates a bounded unique project category list without changing legacy defaults', () => {
  expect(requestObjectDefinitionCheck(schema)).toMatchObject({ categories: ['Strategy', 'Commercial'] });
  expect(() => requestObjectDefinitionCheck({ ...schema, categories: [] })).toThrow();
  expect(() => requestObjectDefinitionCheck({ ...schema, categories: ['Strategy', 'strategy'] })).toThrow();
  expect(() => requestObjectDefinitionCheck({ ...schema, categories: ['x'.repeat(81)] })).toThrow();
});

it('uses only the parent project taxonomy for manual and chat intake, capturing it for future history', async () => {
  const env = await workflowUiFixture();
  try {
    await env.studio.updateProject({ requestObject: schema }, env.project.id);
    await env.studio.createIdea({ title: 'A commercial opportunity', description: 'A scoped business proposal.', category: 'Commercial', username: 'Owner' });
    const first = env.studio.state().ideas[0]!;
    expect(first).toMatchObject({ category: 'Commercial', requestObject: { categories: ['Strategy', 'Commercial'] } });
    await expect(env.studio.createIdea({ title: 'An invalid category proposal', description: 'Do not silently fall back.', category: 'Gameplay', username: 'Owner' })).rejects.toThrow(/categor/i);
    await env.studio.sendChat('Viewer', '!register');
    const submitted = await env.studio.sendChat('Viewer', `!request ${env.project.id} A clear business feature for this project`);
    expect(submitted.ok).toBe(true);
    expect(env.studio.state().ideas.find(idea => idea.id === submitted.ideaId)?.category).toBe('Strategy');
    await env.studio.updateProject({ requestObject: { ...schema, categories: ['Delivery'] } }, env.project.id);
    expect(env.studio.state().ideas.find(idea => idea.id === first.id)?.requestObject?.categories).toEqual(['Strategy', 'Commercial']);
    const original = env.studio.state().ideas.find(idea => idea.id === first.id)!;
    const restored = parseIdeaNote(ideaProperties(original, 'Owner'), ideaBody(original));
    expect(restored).toMatchObject({ category: 'Commercial', requestObject: { categories: ['Strategy', 'Commercial'] } });
    expect(stageInput('screen', { ...restored, voters: [] }, env.studio.state().settings)).toContain('Commercial');
    expect(requestObjectRevision(requestObjectDefinitionCheck(schema))).not.toBe(requestObjectRevision(requestObjectDefinitionCheck({ ...schema, categories: ['Delivery'] })));
    const other = await env.studio.createProject({ projectName: 'Another project', projectBrief: 'The legacy category list stays available.', projectPath: '/synthetic/another' });
    await env.studio.createIdea({ title: 'A legacy gameplay proposal', description: 'An independent project scope.', category: 'Gameplay', username: 'Owner', projectId: other.id });
    expect(env.studio.state().ideas.at(-1)?.category).toBe('Gameplay');
  } finally { await env.dispose(); }
});

it('keeps public export validation strict while accepting escaped custom category labels', () => {
  const state = createSeed();
  const first = state.ideas.find(idea => idea.status === 'ranked')!;
  first.category = 'Commercial & strategy';
  const board = buildPublicBoard(state);
  expect(() => publicExportBoardCheck(board)).not.toThrow();
  expect(() => publicExportBoardCheck({ ...board, columns: board.columns.map(column => ({ ...column, ideas: column.ideas.map(idea => ({ ...idea, category: 'x'.repeat(81) })) })) })).toThrow();
});
