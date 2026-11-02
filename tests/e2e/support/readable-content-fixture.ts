export const READING_TASK = JSON.stringify({
  trustedProject: { name: 'CoForge', brief: 'Build a game with the community.' },
  untrustedCommunityProposal: { title: 'CoWorker hiring pool', description: 'Offer a **Hiring Pool** with curated agent templates.\n\n- Preview each role\n- Choose who to hire', category: 'Quality of life', contexts: [] },
  streamerReviewFeedback: 'Make the hiring choices clear and keep confirmation explicit.',
  currentModeration: { verdict: 'clear', reason: 'An ordinary feature request. No execution was started.' },
});
export const READING_ANSWER = '```json\n' + JSON.stringify({
  summary: '## A hiring pool for CoWorkers\n\nLet the owner **preview a role** before adding an agent.',
  acceptanceCriteria: ['Show the role and capabilities.', 'Require an explicit hiring decision.'],
  risks: ['A template description is a proposal, not permission to run tools.'],
  reviewRequired: true, missingInformation: null,
}) + '\n```';
