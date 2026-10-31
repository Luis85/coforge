import { expect, it } from 'vitest';
import { createSeed } from '../../../features/coforge/domain/seed';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { renderPublicSite } from '../../../features/coforge/domain/public-site';
import { streamSurfaceSnapshot } from '../../../features/coforge/domain/stream-surfaces';
import { overlayPublicBoard, overlayPublicContributors } from '../../../features/coforge/domain/obs-overlay-content';

it('keeps retained conversation evidence out of viewer website, capture views and OBS public projections', () => {
  const state = createSeed();
  const idea = state.ideas.find(item => item.screening?.verdict === 'clear');
  if (!idea) throw new Error('The public fixture requires a screened idea.');
  const capturedAt = '2026-10-31T10:00:00.000Z';
  state.jobs.push({
    id: 'PRIVATE_HISTORY_JOB', ideaId: idea.id, projectId: idea.projectId,
    stage: 'screen', status: 'succeeded', provider: 'claude', startedAt: capturedAt, logs: [],
    conversation: {
      capturedAt, simulated: false,
      instructions: { text: 'PRIVATE_HISTORY_SYSTEM_INSTRUCTIONS', truncated: false },
      prompt: { text: 'PRIVATE_HISTORY_PROMPT_SENT', truncated: false },
      response: { text: 'PRIVATE_HISTORY_LLM_RESPONSE', truncated: false },
      responseCapturedAt: capturedAt,
    },
  });
  const board = buildPublicBoard(state);
  expect(board.columns.flatMap(column => column.ideas).some(item => item.id === idea.id)).toBe(true);
  const projections = [
    board,
    renderPublicSite(board),
    streamSurfaceSnapshot(state, { channelId: 'channel', liveSince: 0 }),
    overlayPublicBoard(state, state.activeProjectId ?? 'CFP-001'),
    overlayPublicContributors(state),
  ];
  for (const projection of projections) expect(JSON.stringify(projection)).not.toContain('PRIVATE_HISTORY_');
  expect(state.jobs.at(-1)?.conversation?.response?.text).toBe('PRIVATE_HISTORY_LLM_RESPONSE');
});
