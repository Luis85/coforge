// @vitest-environment happy-dom
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../../../infrastructure/coforge/process", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../infrastructure/coforge/process")
    >();
  return {
    ...actual,
    captureProcess: (
      executable: string,
      args: string[],
      options: import("../../../infrastructure/coforge/process").ProcessOptions,
    ) =>
      executable === "synthetic-claude"
        ? transport.run(args, options)
        : actual.captureProcess(executable, args, options),
  };
});
import {
  captureProcess,
  ProcessFailure,
} from "../../../infrastructure/coforge/process";
import { record } from "../../../features/coforge/domain/check";
import { executionResult } from "../../../features/coforge/application/workflow-execution";
import { WORKFLOW_MARKDOWN_LIMIT } from "../../../features/coforge/domain/configured-workflow-run";
import { runClaudeStage } from "../../../infrastructure/coforge/claude-runner";
import { LocalWorkflowWorkspaces } from "../../../infrastructure/coforge/workflow-workspaces";
import { LocalHerdrAttemptFiles } from "../../../infrastructure/coforge/herdr-workflow-files";
import { buildClaudeArgs } from "../../../features/coforge/application/claude-protocol";
import {
  herdrResultEnvelope,
  herdrResultOutput,
} from "../../../features/coforge/application/herdr-result";
import {
  createSeed,
  defaultIntegration,
  defaultSettings,
} from "../../../features/coforge/domain/seed";
import type { StageInput } from "../../../features/coforge/application/ports";
import type { WorkflowWorkspaceRecord } from "../../../features/coforge/application/workflow-workspace-ports";
const folders: string[] = [];
it.each(['markdown', 'design'] as const)("uses the same bounded %s Markdown payload in provider schema and result interpretation", output => {
  const input: StageInput = {
    stage: "implement",
    idea: createSeed().ideas[0]!,
    settings: defaultSettings(),
    integration: defaultIntegration(),
    workflow: {
      runId: "run",
      definitionRevision: "definition",
      proposalRevision: "proposal",
      attemptId: "attempt",
      inputArtifacts: [],
      step: {
        id: "plain-report",
        name: "Report",
        kind: "ai",
        instructions: "Explain",
        output,
        access: "none",
        provider: "claude",
        model: "test-model",
        automatic: false,
      },
    },
  };
  const args = buildClaudeArgs(input.stage, input.settings, input.workflow);
  const schema = args[args.indexOf("--json-schema") + 1];
  expect(schema).toBeTypeOf("string");
  if (typeof schema !== "string")
    throw new Error("The configured provider schema argument is missing.");
  expect(JSON.parse(schema).properties.markdown.maxLength).toBe(
    WORKFLOW_MARKDOWN_LIMIT,
  );
  expect(
    executionResult(input, { markdown: "x".repeat(WORKFLOW_MARKDOWN_LIMIT) })
      .markdown,
  ).toHaveLength(WORKFLOW_MARKDOWN_LIMIT);
  expect(() =>
    executionResult(input, {
      markdown: "x".repeat(WORKFLOW_MARKDOWN_LIMIT + 1),
    }),
  ).toThrow();
  if (output === 'design') {
    expect(JSON.parse(schema).properties.markdown.pattern).toBe('\\S');
    expect(() => executionResult(input, { markdown: ' \n\t ' })).toThrow();
  } else expect(() => executionResult(input, { markdown: ' \n\t ' })).toThrow();
});

it('runs a Design specification through the native read-only profile and validates its Herdr transport payload', async () => {
  const { input, workspaces, project } = await fixture();
  const workflow = input.workflow!;
  const persona = `${'r'.repeat(15900)} END OF SAVED CLAUDE PERSONA`;
  const designInput: StageInput = { ...input, stage: 'plan', workflow: { ...workflow,
    coworker: { format: 'coforge-workflow-coworker/v1', id: 'saved-designer', revision: 'designer-revision', name: 'Saved designer', role: 'Compatibility designer', instructions: persona, provider: 'claude', model: workflow.step.model },
    step: { ...workflow.step, id: 'design', name: 'Design', coworkerId: 'saved-designer', output: 'design', access: 'readproject' } } };
  transport.run.mockImplementationOnce(async (args, options) => {
    expect(options.input).toContain(persona); expect(args.join(' ')).not.toContain(persona);
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Glob,Grep');
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1]).required).toEqual(['markdown']);
    expect(await readFile(join(options.cwd, 'game.txt'), 'utf8')).toBe('original\n');
    return envelope({ markdown: '# Native Design\n\nRetain the existing save format.' });
  });
  const result = await runClaudeStage(designInput, workspaces);
  expect(result.markdown).toContain('Retain the existing save format.');
  expect(result.increment).toBeUndefined();
  expect(await readFile(join(project, 'game.txt'), 'utf8')).toBe('original\n');
  const expected = { id: 'design-transport', jobId: 'design-job', ideaId: input.idea.id, projectId: 'CFP-001', stage: designInput.stage, fingerprint: 'proposal-one', nonce: 'design-nonce', workflow: designInput.workflow };
  expect(herdrResultOutput({ ...herdrResultEnvelope(expected), output: { markdown: '# Herdr Design' } }, expected)).toEqual({ markdown: '# Herdr Design' });
  expect(() => herdrResultOutput({ ...herdrResultEnvelope(expected), output: { summary: 'Wrong contract' } }, expected)).toThrow();
});
afterEach(async () => {
  transport.run.mockReset();
  for (const folder of folders.splice(0))
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
});
const envelope = (output: unknown) =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    structured_output: output,
    usage: { input_tokens: 0, output_tokens: 12 },
  });
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), "coforge-configured-provider-"));
  folders.push(folder);
  const project = join(folder, "project");
  await mkdir(project);
  await captureProcess("git", ["init", "-q"], { cwd: project });
  await writeFile(join(project, "game.txt"), "original\n");
  await captureProcess("git", ["add", "game.txt"], { cwd: project });
  await captureProcess(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "fixture",
    ],
    { cwd: project },
  );
  let records: WorkflowWorkspaceRecord[] = [];
  const workspaces = new LocalWorkflowWorkspaces(
    {
      load: async () => structuredClone(records),
      save: async (next) => {
        records = structuredClone(next);
      },
    },
    folder,
  );
  await workspaces.start();
  const input: StageInput = {
    jobId: "job-one",
    stage: "screen",
    idea: { ...createSeed().ideas[0]!, projectId: "CFP-001" },
    settings: { ...defaultSettings(), provider: "claude" },
    integration: {
      ...defaultIntegration(),
      claudeBin: "synthetic-claude",
      projectPath: project,
      worktreeFolder: join(folder, "worktrees"),
      allowImplementation: true,
    },
    workflow: {
      runId: "run-one",
      definitionRevision: "definition-one",
      proposalRevision: "proposal-one",
      attemptId: "attempt-one",
      inputArtifacts: [],
      step: {
        id: "custom-editor",
        name: "Research and edit",
        instructions: "Improve the game and explain it.",
        kind: "ai",
        output: "markdown",
        access: "editworktree",
        provider: "claude",
        model: "test-model",
        automatic: false,
      },
    },
  };
  return { folder, project, workspaces, input };
}
it("uses configured output/access independently of legacy IDs and keeps sequential native review on the edited workspace", async () => {
  const { input, workspaces, project } = await fixture();
  const sequence: string[] = [];
  let workspaceId = "";
  input.onWorkspace = async (id) => {
    workspaceId = id;
    sequence.push("workspace-persisted");
  };
  input.onChanges = vi.fn(async () => undefined);
  input.onTokenUsage = vi.fn(async () => undefined);
  transport.run.mockImplementationOnce(async (args, options) => {
    sequence.push("agent-start");
    expect(args[args.indexOf("--tools") + 1]).toContain("Edit");
    expect(
      JSON.parse(args[args.indexOf("--json-schema") + 1]).required,
    ).toEqual(["markdown"]);
    await writeFile(join(options.cwd, "game.txt"), "changed by report step\n");
    return envelope({ markdown: "# Findings\nImproved the game." });
  });
  const first = await runClaudeStage(input, workspaces);
  expect(sequence).toEqual(["workspace-persisted", "agent-start"]);
  expect(first.markdown).toContain("# Findings");
  expect(first.increment?.diff).toContain("+changed by report step");
  expect(input.onChanges).toHaveBeenCalledWith(first.increment);
  expect(input.onTokenUsage).toHaveBeenCalledWith({
    inputTokens: 0,
    outputTokens: 12,
  });
  expect(await readFile(join(project, "game.txt"), "utf8")).toBe("original\n");
  const workflow = input.workflow!;
  transport.run.mockImplementationOnce(async (args, options) => {
    expect(args[args.indexOf("--tools") + 1]).toBe("Read,Glob,Grep");
    expect(await readFile(join(options.cwd, "game.txt"), "utf8")).toBe(
      "changed by report step\n",
    );
    return envelope({ markdown: "Reviewed the actual edit." });
  });
  const review = await runClaudeStage(
    {
      ...input,
      stage: "implement",
      workflow: {
        ...workflow,
        workspaceId,
        attemptId: "attempt-two",
        step: { ...workflow.step, id: "review-custom", access: "readproject" },
      },
    },
    workspaces,
  );
  expect(review.markdown).toBe("Reviewed the actual edit.");
  expect(review.increment?.worktree).toBe(first.increment?.worktree);
  transport.run.mockImplementationOnce(async (_args, options) => {
    await writeFile(join(options.cwd, "game.txt"), "original\n");
    return envelope({ markdown: "Reverted the experiment." });
  });
  const reverted = await runClaudeStage(
    {
      ...input,
      workflow: { ...workflow, workspaceId, attemptId: "attempt-three" },
    },
    workspaces,
  );
  expect(reverted.increment).toBeUndefined();
  expect(input.onChanges).toHaveBeenLastCalledWith(null);
  transport.run.mockImplementationOnce(async (_args, options) => {
    await writeFile(join(options.cwd, "game.txt"), "partial actual edit\n");
    return envelope({ markdown: 123 });
  });
  await expect(
    runClaudeStage(
      {
        ...input,
        workflow: { ...workflow, workspaceId, attemptId: "attempt-four" },
      },
      workspaces,
    ),
  ).rejects.toThrow("schema validation");
  expect(input.onChanges).toHaveBeenLastCalledWith(
    expect.objectContaining({
      diff: expect.stringContaining("+partial actual edit"),
    }),
  );
  const cancellation = new AbortController();
  transport.run.mockImplementationOnce(async (_args, options) => {
    await writeFile(join(options.cwd, "game.txt"), "cancelled actual edit\n");
    cancellation.abort();
    throw new ProcessFailure(
      "Run cancelled.",
      envelope({ markdown: "Stopped" }),
    );
  });
  await expect(
    runClaudeStage(
      {
        ...input,
        signal: cancellation.signal,
        workflow: { ...workflow, workspaceId, attemptId: "attempt-five" },
      },
      workspaces,
    ),
  ).rejects.toThrow("Run cancelled.");
  expect(input.onChanges).toHaveBeenLastCalledWith(
    expect.objectContaining({
      diff: expect.stringContaining("+cancelled actual edit"),
    }),
  );
  expect(input.onTokenUsage).toHaveBeenLastCalledWith({
    inputTokens: 0,
    outputTokens: 12,
  });
}, 30000);
it("uses fresh Herdr artifact paths for the same run workspace and correlates configured identity rather than stage labels", async () => {
  const { input, workspaces, folder } = await fixture();
  const files = new LocalHerdrAttemptFiles(folder, workspaces);
  const workflow = input.workflow!;
  const first = await files.prepare({ ...input, jobId: "job-one" });
  await writeFile(join(first.cwd, "game.txt"), "herdr edit\n");
  const result = await first.finish({ markdown: "Edited and documented." });
  expect(result.increment?.diff).toContain("+herdr edit");
  await first.release?.(false);
  const second = await files.prepare({
    ...input,
    jobId: "job-two",
    workflow: {
      ...workflow,
      attemptId: "attempt-two",
      workspaceId: first.workspaceId,
    },
  });
  expect(second.cwd).toBe(first.cwd);
  expect(second.resultPath).not.toBe(first.resultPath);
  expect(await second.readResult()).toBeNull();
  const expected = {
    id: "transport-one",
    jobId: "job-two",
    ideaId: input.idea.id,
    projectId: "CFP-001",
    stage: input.stage,
    fingerprint: "proposal-one",
    nonce: "nonce-one",
    workflow: { ...workflow, attemptId: "attempt-two" },
    workspaceId: second.workspaceId,
  };
  const correlation = herdrResultEnvelope(expected);
  expect(
    herdrResultOutput(
      { ...correlation, output: { markdown: "Valid report" } },
      expected,
    ),
  ).toEqual({ markdown: "Valid report" });
  const fields = record(correlation);
  expect(
    herdrResultOutput(
      {
        ...fields,
        workflow: Object.fromEntries(
          Object.entries(record(fields.workflow)).reverse(),
        ),
        output: { markdown: "Reordered JSON keys" },
      },
      expected,
    ),
  ).toEqual({ markdown: "Reordered JSON keys" });
  expect(() =>
    herdrResultOutput(
      {
        ...correlation,
        workflow: { runId: "different" },
        output: { markdown: "Wrong run" },
      },
      expected,
    ),
  ).toThrow("different");
  expect(() =>
    herdrResultOutput(
      { ...correlation, costUsd: 0, output: { markdown: "Invented usage" } },
      expected,
    ),
  ).toThrow();
  await second.release?.(false);
  const args = buildClaudeArgs("implement", input.settings, {
    ...workflow,
    step: { ...workflow.step, id: "isolated-note", access: "none" },
  });
  expect(args[args.indexOf("--tools") + 1]).toBe("");
}, 30000);
