import { expect, it, vi } from "vitest";
import { observeWorkflowOutputTemplates } from "../../../features/coforge/application/workflow-output-template-events";
import type { WorkflowOutputTemplateActions } from "../../../features/coforge/application/workflow-output-templates";

it("publishes named facts only after successful template writes and isolates observer failures", async () => {
  const saved = {
    id: "answer",
    projectId: "CFP-001",
    name: "Answer",
    markdown: "# Answer",
    revision: "one",
  };
  const sequence: string[] = [];
  const source: WorkflowOutputTemplateActions = {
    list: async () => ({ templates: [saved], invalid: [] }),
    save: vi.fn(async () => {
      sequence.push("write");
      return saved;
    }),
    remove: vi.fn(async () => {
      sequence.push("trash");
    }),
    open: vi.fn(async () => undefined),
  };
  const failed = vi.fn();
  const committed = vi.fn(async (code: string, id: string) => {
    sequence.push(`${code}:${id}`);
    throw new Error("Observer unavailable");
  });
  const actions = observeWorkflowOutputTemplates(source, committed, failed);
  await expect(
    actions.save("CFP-001", { name: "Answer", markdown: "# Answer" }),
  ).resolves.toEqual(saved);
  await expect(
    actions.remove("CFP-001", "answer", "one"),
  ).resolves.toBeUndefined();
  expect(sequence).toEqual([
    "write",
    "workflow-output-template-saved:answer",
    "trash",
    "workflow-output-template-deleted:answer",
  ]);
  expect(failed).toHaveBeenCalledTimes(2);
  expect(committed).toHaveBeenNthCalledWith(
    1,
    "workflow-output-template-saved",
    "answer",
    "CFP-001",
  );
  vi.mocked(source.save).mockRejectedValueOnce(new Error("Write failed"));
  await expect(
    actions.save("CFP-001", { name: "Answer", markdown: "# New answer" }),
  ).rejects.toThrow("Write failed");
  expect(committed).toHaveBeenCalledTimes(2);
  await actions.list("CFP-001");
  await actions.open("CFP-001", "answer");
  expect(committed).toHaveBeenCalledTimes(2);
});
