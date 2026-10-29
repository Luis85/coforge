import { expect, it } from 'vitest';
import { executionCostTasks } from '../../../features/coforge/application/execution-costs';
import { costSummary } from '../../../features/coforge/domain/ai-costs';
import { tokenSummary } from '../../../features/coforge/domain/ai-usage';
import { fanoutFixture } from './execution-fanout-fixture';

it('retains streamed telemetry through partial final fan-out responses, persists it on artifacts and counts each provider call once', async () => {
  const fixture = fanoutFixture();
  fixture.host.invoke = async (run, invocation, attempt) => {
    await fixture.kernel.recordTelemetry(run.id, attempt.id, { inputTokens: 10, cacheReadInputTokens: 3, cacheCreationInputTokens: 2 }, 0.2);
    return { markdown: `Result ${invocation.id}`, simulated: false, usage: { outputTokens: 5 } };
  };
  await fixture.kernel.load(); await fixture.kernel.admit(fixture.admission); fixture.kernel.resume();
  await fixture.kernel.step('run');
  const run = fixture.journal.runs[0]!;
  expect(run.attempts).toHaveLength(2); expect(run.artifacts).toHaveLength(2);
  const usage = { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 3, cacheCreationInputTokens: 2 };
  for (const attempt of run.attempts) expect(attempt).toMatchObject({ usage, costUsd: 0.2 });
  for (const artifact of run.artifacts) expect(artifact).toMatchObject({ usage, costUsd: 0.2 });
  const tasks = executionCostTasks([run], []);
  expect(tasks).toHaveLength(2);
  expect(costSummary(tasks)).toMatchObject({ nanos: 400000000n, reported: 2, missing: 0 });
  expect(tokenSummary(tasks)).toMatchObject({ inputTokens: 20n, outputTokens: 10n, cacheReadInputTokens: 6n, cacheCreationInputTokens: 4n, totalInputTokens: 30n });
});
