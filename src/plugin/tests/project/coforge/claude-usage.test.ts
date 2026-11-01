import { expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../../../infrastructure/coforge/process", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../infrastructure/coforge/process")
  >()),
  captureProcess: transport.run,
}));
import { runClaudeStage } from "../../../infrastructure/coforge/claude-runner";
import { ProcessFailure } from "../../../infrastructure/coforge/process";
import {
  createSeed,
  defaultIntegration,
  defaultSettings,
} from "../../../features/coforge/domain/seed";
import type { StageUsage } from "../../../features/coforge/domain/ai-usage";
it("reports provider tokens before invalid structured output or process failure can discard the attempt", async () => {
  const seen: StageUsage[] = [];
  const input = {
    stage: "screen" as const,
    idea: createSeed().ideas[0]!,
    settings: defaultSettings(),
    integration: defaultIntegration(),
    onTokenUsage: async (usage: StageUsage) => {
      seen.push(usage);
    },
  };
  const raw = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    usage: { input_tokens: 0, output_tokens: 12 },
    structured_output: { verdict: "invalid" },
  });
  transport.run.mockResolvedValueOnce(raw);
  await expect(runClaudeStage(input)).rejects.toMatchObject({ failure: { code: 'output_validation' } });
  expect(seen).toEqual([{ inputTokens: 0, outputTokens: 12 }]);
  const failed = JSON.stringify({
    type: "result",
    subtype: "error_max_turns",
    is_error: true,
    usage: {
      input_tokens: 20,
      output_tokens: 0,
      cache_read_input_tokens: 8,
      cache_creation_input_tokens: 0,
    },
  });
  transport.run.mockRejectedValueOnce(
    new ProcessFailure("Synthetic process failure", failed),
  );
  await expect(runClaudeStage(input)).rejects.toMatchObject({ failure: { code: 'turn_limit' } });
  expect(seen[1]).toEqual({
    inputTokens: 20,
    outputTokens: 0,
    cacheReadInputTokens: 8,
    cacheCreationInputTokens: 0,
  });
  transport.run.mockRejectedValueOnce(
    new ProcessFailure("Run cancelled.", failed),
  );
  await expect(runClaudeStage(input)).rejects.toMatchObject({ failure: { code: 'cancelled' } });
  expect(seen[2]).toEqual(seen[1]);
  transport.run.mockRejectedValueOnce(new ProcessFailure('claude exited with code 1. Check the CLI installation and authentication.', failed));
  await expect(runClaudeStage(input)).rejects.toThrow('turn limit');
  expect(seen[3]).toEqual(seen[1]);
});
