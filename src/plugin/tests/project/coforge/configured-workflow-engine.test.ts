import { describe, expect, it } from "vitest";
import { ai, definition, fixture, increment, result } from "./configured-workflow-fixture";

describe("actual configured workflow execution", () => {
  it("executes arbitrary reordered and repeated roles by stable step identity, without fixed predecessor statuses", async () => {
    const f = await fixture([
      ai("plan-first", "plan"),
      ai("notes-one"),
      ai("score-later", "rice"),
      ai("notes-two"),
    ]);
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.calls.map((input) => input.workflow?.step.id)).toEqual([
      "plan-first",
      "notes-one",
      "score-later",
      "notes-two",
    ]);
    expect(f.current().workflowRun).toMatchObject({
      state: "finished",
      cursor: 4,
    });
    expect(
      f.current().workflowRun?.artifacts.map((item) => item.output),
    ).toEqual(["plan", "markdown", "rice", "markdown"]);
    expect(f.current().increment).toBeUndefined();
    expect(f.current().status).not.toBe("shipped");
  });

  it("pauses for manual approval/checklists, releases the worker, and validates revision and required items", async () => {
    const f = await fixture([
      ai("research"),
      {
        id: "approval",
        name: "Approval",
        instructions: "Inspect research",
        kind: "approval",
      },
      {
        id: "checks",
        name: "Checks",
        instructions: "Complete checklist",
        kind: "checklist",
        items: [{ id: "required", label: "Verified", required: true }],
      },
      ai("finish"),
    ]);
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe("waiting-human");
    expect(
      f.store.snapshot().jobs.every((job) => job.status !== "running"),
    ).toBe(true);
    const approval = f.current().workflowRun!;
    await expect(
      f.engine.completeWorkflowManual(f.idea.id, approval.revision - 1, []),
    ).rejects.toThrow("changed");
    await f.engine.completeWorkflowManual(f.idea.id, approval.revision, []);
    const checklist = f.current().workflowRun!;
    await expect(
      f.engine.completeWorkflowManual(f.idea.id, checklist.revision, []),
    ).rejects.toThrow("required");
    await f.engine.completeWorkflowManual(f.idea.id, checklist.revision, [
      "required",
    ]);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe("finished");
    expect(f.calls.map((input) => input.workflow?.step.id)).toEqual([
      "research",
      "finish",
    ]);
  });

  it("pins definition, model, instructions, limits and general project prompt for later attempts", async () => {
    let started: () => void = () => {};
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release: () => void = () => {};
    const pause = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = await fixture(
      [ai("first"), { ...ai("second"), model: "pinned-model" }],
      async (input) => {
        if (input.workflow?.step.id === "first") {
          started();
          await pause;
        }
        return result(input);
      },
    );
    await f.engine.startWorkflow(f.idea.id);
    await entered;
    await f.store.transaction((state) => {
      state.settings.workflow = {
        ...definition([ai("replacement")]),
        revision: "new-revision",
      };
      state.settings.agentPrompt = "Changed future prefix";
    });
    release();
    await f.engine.waitUntilIdle();
    expect(f.calls.map((input) => input.workflow?.step.id)).toEqual([
      "first",
      "second",
    ]);
    expect(f.calls[1]?.settings.model).toBe("pinned-model");
    expect(f.calls[1]?.settings.agentPrompt).not.toBe("Changed future prefix");
    expect(f.calls[1]?.workflow?.definitionRevision).toBe("custom-v1");
  });

  it("rejects stale proposal results while retaining per-attempt reported usage", async () => {
    let started: () => void = () => {};
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release: () => void = () => {};
    const pause = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = await fixture([ai("research")], async (input) => {
      started();
      await pause;
      return { ...result(input), costUsd: 0.12, usage: { inputTokens: 10 } };
    });
    await f.engine.startWorkflow(f.idea.id);
    await entered;
    await f.store.transaction((state) => {
      state.ideas.find((idea) => idea.id === f.idea.id)!.description +=
        " Revised by viewer context";
    });
    release();
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe("attention");
    expect(f.current().workflowRun?.artifacts).toEqual([]);
    expect(f.store.snapshot().jobs.at(-1)).toMatchObject({
      status: "failed",
      costUsd: 0.12,
      usage: { inputTokens: 10 },
    });
  });

  it("persists workspace ownership before continuation and carries it into later steps", async () => {
    const f = await fixture(
      [
        ai("edit", "markdown", "editworktree"),
        ai("inspect", "markdown", "readproject"),
      ],
      async (input) => {
        if (input.workflow?.step.id === "edit")
          await input.onWorkspace?.("workspace-one");
        return result(input);
      },
    );
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.workspaceId).toBe("workspace-one");
    expect(f.calls[1]?.workflow?.workspaceId).toBe("workspace-one");
  });

  it("requires final host review for actual edits even when AI output is Markdown", async () => {
    const f = await fixture(
      [
        ai("edit-report", "markdown", "editworktree"),
        { id: "check", name: "Check", instructions: "", kind: "approval" },
      ],
      async (input) => ({ ...result(input), increment }),
    );
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe("waiting-human");
    await expect(f.engine.action(f.idea.id, "approve")).rejects.toThrow(
      "Finish or stop",
    );
    await f.engine.completeWorkflowManual(
      f.idea.id,
      f.current().workflowRun!.revision,
      [],
    );
    expect(f.current().workflowRun?.state).toBe("awaiting-review");
    await f.engine.action(f.idea.id, "approve");
    expect(f.current().status).toBe("shipped");
    expect(f.current().workflowRun?.state).toBe("finished");
  });

  it("preserves real changes from a failed attempt without advancing the cursor", async () => {
    const f = await fixture(
      [ai("editing", "markdown", "editworktree")],
      async (input) => {
        await input.onChanges?.(increment);
        throw new Error("Invalid model output");
      },
    );
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun).toMatchObject({
      state: "attention",
      cursor: 0,
    });
    expect(f.current().increment?.diff).toBe("+code");
    await f.engine.stopWorkflow(f.idea.id);
    expect(f.current().workflowRun?.state).toBe("awaiting-review");
  });

  it("clears an earlier pending cumulative diff when a later verified workspace capture is empty", async () => {
    const f = await fixture(
      [
        ai("make-edit", "markdown", "editworktree"),
        ai("revert", "markdown", "editworktree"),
      ],
      async (input) => {
        if (input.workflow?.step.id === "make-edit")
          return { ...result(input), increment };
        await input.onChanges?.(null);
        return result(input);
      },
    );
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe("finished");
    expect(f.current().increment).toBeUndefined();
    expect(f.current().status).not.toBe("review");
  });

  it("does not fabricate an implementation when a codechange step returns a legitimate no-op summary", async () => {
    const f = await fixture([ai("already-done", "codechange", "editworktree")]);
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe("finished");
    expect(f.current().increment).toBeUndefined();
    await expect(f.engine.action(f.idea.id, "approve")).rejects.toThrow();
  });

  it("allows explicit standard-workflow start without rewriting legacy project configuration", async () => {
    const f = await fixture([ai("placeholder")]);
    await f.store.transaction((state) => {
      delete state.settings.workflow;
      state.settings.paused = true;
    });
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(
      f.current().workflowRun?.definition.steps.map((step) => step.id),
    ).toEqual(["screen", "score", "plan", "design", "implement"]);
    expect(f.store.snapshot().settings.workflow).toBeUndefined();
    expect(f.current().workflowRun?.cursor).toBe(1);
    await f.engine.runWorkflowStep(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.cursor).toBe(2);
  });

  it("enforces per-step vote thresholds and refuses legacy stage bypasses for configured requests", async () => {
    const f = await fixture([{ ...ai("gated"), minVotes: 10000 }]);
    await expect(f.engine.startWorkflow(f.idea.id)).rejects.toThrow("votes");
    await expect(f.engine.submit(f.idea.id, "screen")).rejects.toThrow(
      "configured",
    );
    expect(f.runner).not.toHaveBeenCalled();
  });

  it("stops manual waits and requires a fresh explicit start, preserving previous run history", async () => {
    const f = await fixture([
      { id: "approve", name: "Approve", instructions: "", kind: "approval" },
    ]);
    await f.engine.startWorkflow(f.idea.id);
    const original = f.current().workflowRun!.id;
    await f.engine.stopWorkflow(f.idea.id);
    await expect(f.engine.runWorkflowStep(f.idea.id)).rejects.toThrow(
      "current state",
    );
    await f.engine.startWorkflow(f.idea.id);
    expect(f.current().workflowRun!.id).not.toBe(original);
    expect(f.current().workflowHistory?.[0]?.id).toBe(original);
  });

  it("records manual progress without inflating AI job statistics", async () => {
    const f = await fixture([
      { id: "approval", kind: "approval", name: "Approval", instructions: "" },
    ]);
    const before = f.store.snapshot().population!.counters;
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.completeWorkflowManual(
      f.idea.id,
      f.current().workflowRun!.revision,
      [],
    );
    const counters = f.store.snapshot().population!.counters;
    expect(counters["job-queued"] ?? 0).toBe(before["job-queued"] ?? 0);
    expect(counters["job-completed"] ?? 0).toBe(before["job-completed"] ?? 0);
    expect(counters["workflow-manual-waiting"]).toBe(1);
    expect(counters["workflow-manual-completed"]).toBe(1);
    expect(counters["workflow-run-started"]).toBe(1);
    expect(counters["workflow-run-finished"]).toBe(1);
  });

  it("keeps actionable bounded errors on failed tasks and their run", async () => {
    const f = await fixture([ai("inspect")], async () => {
      throw new Error(
        "The workspace lease needs recovery before it can be reused.",
      );
    });
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.error).toContain(
      "workspace lease needs recovery",
    );
    expect(f.store.snapshot().jobs.at(-1)?.error).toContain(
      "workspace lease needs recovery",
    );
  });

  it("enforces actual access permissions for custom edit output and permits isolated Herdr steps without a repo", async () => {
    const denied = await fixture([
      { ...ai("write-report", "markdown", "editworktree"), provider: "claude" },
    ]);
    await denied.store.transaction((state) => {
      state.integration.allowImplementation = false;
    });
    await expect(denied.engine.startWorkflow(denied.idea.id)).rejects.toThrow(
      "Enable implementation",
    );
    expect(denied.runner).not.toHaveBeenCalled();
    const isolated = await fixture([{ ...ai("isolated"), provider: "herdr" }]);
    await isolated.store.transaction((state) => {
      state.integration.projectPath = "";
      state.runtime.herdrWorkflow = { ready: true, busy: false, message: "" };
    });
    await isolated.engine.startWorkflow(isolated.idea.id);
    await isolated.engine.waitUntilIdle();
    expect(isolated.current().workflowRun?.state).toBe("finished");
  });

  it("rejects malformed output without pretending a different role succeeded", async () => {
    const f = await fixture([ai("report")], async () => ({
      summary: "Not Markdown output.",
    }));
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun).toMatchObject({
      state: "attention",
      cursor: 0,
      artifacts: [],
    });
    expect(f.store.snapshot().jobs.at(-1)?.status).toBe("failed");
  });
});
