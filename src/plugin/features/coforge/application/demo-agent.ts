import { samplePlan, sampleIncrement } from '../domain/seed';
import { riceValue } from '../domain/types';
import { heuristicSignals } from '../domain/workflow';
import type { StageInput, StageResult, Timers } from './ports';

/** An abortable pause. Rejects with "Run cancelled." when the signal fires. */
export function pause(timers: Timers, ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Run cancelled.')); return; }
    const abort = () => { timers.clearTimeout(timer); reject(new Error('Run cancelled.')); };
    const timer = timers.setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

const NARRATION = {
  screen: 'Inspecting the request for instruction overrides and suspicious operations.',
  score: 'Estimating 30-day reach, player impact, confidence, and effort.',
  plan: 'Drafting a small increment with implementation steps and acceptance criteria.',
  implement: 'Simulating a change set and a review handoff.',
} as const;

/** Clearly simulated agent output. No model is called and no game files are modified. */
export function createDemoRunner(timers: Timers, delays: readonly [number, number] = [500, 650]) {
  return async ({ stage, idea, signal, onLog, workflow }: StageInput): Promise<StageResult> => {
    onLog?.('Demo agent started. No external model is called and no game files are modified.');
    await pause(timers, delays[0], signal);
    onLog?.(workflow ? `Simulating ${workflow.step.name}.` : NARRATION[stage]);
    await pause(timers, delays[1], signal);
    const now = new Date().toISOString();
    const output = workflow?.step.output ?? (stage === 'screen' ? 'screening' : stage === 'score' ? 'rice' : stage === 'plan' ? 'plan' : 'codechange');
    if (output === 'design') {
      const plan = workflow?.inputArtifacts.find(artifact => artifact.output === 'plan')?.plan;
      return { markdown: `## Simulated Design: ${idea.title}\n\nDemonstration only: no model was called. This simulation did not inspect the repository, modify files or execute tests.\n\n`
        + `### Intended behavior\n\n${plan?.summary ?? `Prepare a small specification for ${idea.title}.`}\n\n`
        + `### Components and data\n\nUse the captured plan as the starting point: ${plan?.steps[0] ?? 'Identify the smallest affected interaction.'}\n\n`
        + 'Reuse existing interaction and persistence contracts. Exact component names and data changes require repository inspection with a real provider.\n\n'
        + `### Acceptance scenario\n\n${plan?.acceptanceCriteria[0] ?? 'The intended interaction is reachable during ordinary play.'}\n\n`
        + '### Failure and recovery\n\nPreserve existing progress when the interaction is unavailable or interrupted. Identify the actual failure boundaries before implementation.\n\n'
        + '### Open questions\n\nConfirm the affected components, save compatibility and edge cases against the repository. This illustrative specification is not evidence of implementation or verification.' };
    }
    if (output === 'markdown') return { markdown: `## Simulated ${workflow?.step.name ?? 'analysis'}\n\nIllustrative notes for ${idea.id}: ${idea.title}. No model was called and no game files were modified.` };
    if (output === 'screening') {
      const signals = heuristicSignals(`${idea.title}\n${idea.description}\n${idea.requestObject ? JSON.stringify(idea.requestObject) : ''}`);
      return { screening: {
        verdict: signals.length ? 'flagged' : 'clear', signals, checkedAt: now, provider: 'demo',
        reason: signals.length
          ? 'The request contains suspicious instructions. Hold it for streamer moderation before dispatching further work.'
          : 'No known injection patterns were found by the demo heuristic. This is a demonstration, not a guarantee that the request is safe.',
      } };
    }
    if (output === 'rice') {
      const hash = [...idea.title].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const values = { reach: 80 + (hash % 240), impact: [0.5, 1, 2, 3][hash % 4]!, confidence: [0.5, 0.65, 0.8][hash % 3]!, effort: [0.5, 1, 2, 3][hash % 4]! };
      return { rice: { ...values, score: riceValue(values),
        rationale: `Illustrative demo estimate for 30 days: ${values.reach} players reached × ${values.impact} impact × ${Math.round(values.confidence * 100)}% confidence ÷ ${values.effort} person-days. Votes are shown separately and do not determine reach. Validate these assumptions against the actual game and audience.` } };
    }
    if (output === 'plan') return { plan: samplePlan(idea.title, now) };
    return { increment: sampleIncrement(idea.title, now) };
  };
}
