import { councilControlsFixture as fixture } from "./council-controls-fixture";
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { record } from "../../../features/coforge/domain/check";
import { defaultCouncilDefinition } from "../../../features/coforge/domain/council-definitions";
import { workflowV2DefinitionCheck } from "../../../features/coforge/domain/configured-workflow-v2";
import {
  projectProperties,
  projectBody,
} from "../../../features/coforge/domain/project-note";
import { stringify } from "yaml";
import { reviewedCouncilIdentity } from "../../../features/coforge/application/reviewed-preflight";

afterEach(() => {
  vi.useRealTimers();
});
describe("operator controls and live execution authority", () => {
  it('honors operator Draft after admission and resumes the same captured input only after Ready and explicit retry', async () => {
    vi.useFakeTimers(); const f = await fixture();
    try {
      const path = 'CoForge/Tests/Operator-draft.md'; const run = await f.module.actions.simulate(f.target, 'Private/Proposal.md', path);
      await f.module.actions.setSourceState(path, { draft: true, ready: false }); await f.module.actions.resume(); await vi.advanceTimersByTimeAsync(1000);
      const paused = f.module.actions.snapshot().runs.find(item => item.id === run.id)!; expect(paused.state).toBe('attention'); expect(paused.attempts).toEqual([]); expect(paused.reason).toContain('Draft');
      await f.module.actions.setSourceState(path, { draft: false, ready: true }); await f.module.actions.retry(run.id, false); await vi.advanceTimersByTimeAsync(1000);
      const completed = f.module.actions.snapshot().runs.find(item => item.id === run.id)!; expect(completed.state).toBe('completed'); expect(completed.subject).toEqual(run.subject);
    } finally { await f.dispose(); }
  });
  it("pins the owning project prompt across project selection and rejects a changed reviewed preflight before any simulation write", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      await f.studio.updateSettings({ agentPrompt: "General project A." });
      const other = await f.studio.createProject({
        projectName: "Other project",
        projectBrief: "Other brief",
        projectPath: "/synthetic/other",
      });
      await f.studio.updateSettings({ agentPrompt: "General project B." });
      await f.studio.selectProject(other.id);
      const preview = await f.module.actions.preflight(
        f.target,
        "Private/Proposal.md",
      );
      expect(preview.projectPrompt).toBe("General project A.");
      expect(preview.context).not.toContain("General project B.");
      await f.studio.selectProject(f.projectId);
      await f.studio.updateSettings({ agentPrompt: "Updated project A." });
      await f.studio.selectProject(other.id);
      await expect(
        f.module.actions.simulate(
          f.target,
          "Private/Proposal.md",
          "CoForge/Tests/Stale.md",
          reviewedCouncilIdentity(preview),
        ),
      ).rejects.toThrow();
      expect(
        f.app.vault.getAbstractFileByPath("CoForge/Tests/Stale.md"),
      ).toBeNull();
      expect(f.kit.read("Private/Proposal.md")).toBe(
        "The original proposal.\n",
      );
      expect(f.module.actions.snapshot().runs).toEqual([]);
      const fresh = await f.module.actions.preflight(
        f.target,
        "Private/Proposal.md",
      );
      const run = await f.module.actions.simulate(
        f.target,
        "Private/Proposal.md",
        "CoForge/Tests/Pinned.md",
        reviewedCouncilIdentity(fresh),
      );
      await f.studio.selectProject(f.projectId);
      await f.studio.updateSettings({ agentPrompt: "Future prompt." });
      await f.studio.selectProject(other.id);
      await f.module.actions.resume();
      await vi.advanceTimersByTimeAsync(1000);
      const completed = f.module.actions
        .snapshot()
        .runs.find((item) => item.id === run.id)!;
      expect(
        completed.invocations[0]?.instructions.startsWith("Updated project A."),
      ).toBe(true);
      expect(completed.invocations[0]?.instructions).not.toContain(
        "Future prompt.",
      );
    } finally {
      await f.dispose();
    }
  });
  it("blocks dispatch when an indexed source is moved into public exports after admission", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const run = await f.module.actions.simulate(
        f.target,
        "Private/Proposal.md",
        "CoForge/Tests/Moving.md",
      );
      if (!f.app.vault.getAbstractFileByPath("CoForge/Public"))
        await f.app.vault.createFolder("CoForge/Public");
      const file = f.app.vault.getFileByPath("CoForge/Tests/Moving.md")!;
      const original = await f.app.vault.read(file);
      await f.app.vault.rename(file, "CoForge/Public/Moving.md");
      await f.module.actions.resume();
      await vi.advanceTimersByTimeAsync(1000);
      const blocked = f.module.actions
        .snapshot()
        .runs.find((item) => item.id === run.id)!;
      expect(blocked.state).toBe("attention");
      expect(blocked.attempts).toEqual([]);
      expect(await f.app.vault.read(file)).toBe(original);
    } finally {
      await f.dispose();
    }
  });
  it("allows disabling a broken inbox and saving unrelated disabled inboxes without resolving their targets", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const binding = {
        id: "inbox",
        path: "Private/Queue",
        projectId: f.projectId,
        teamId: "team",
        target: { kind: f.target.kind, id: f.target.id },
        enabled: true,
        recursive: false,
        submit: "after-stable" as const,
        settleMs: 2000,
      };
      await f.module.actions.saveBindings(
        [binding],
        f.module.actions.snapshot().preferences.revision,
      );
      const agent = (await f.module.actions.catalogue.list()).valid.find(
        (entry) => entry.definition.id === "agent",
      )!;
      await f.module.actions.catalogue.save(
        { ...agent.definition, enabled: false },
        agent.revision,
      );
      const disabled = {
        ...binding,
        id: "unrelated",
        path: "Private/Other",
        enabled: false,
        target: { kind: "agent" as const, id: "missing" },
      };
      await f.module.actions.saveBindings(
        [binding, disabled],
        f.module.actions.snapshot().preferences.revision,
      );
      await f.module.actions.saveBindings(
        [{ ...binding, enabled: false }, disabled],
        f.module.actions.snapshot().preferences.revision,
      );
      expect(
        f.module.actions
          .snapshot()
          .preferences.bindings.every((item) => !item.enabled),
      ).toBe(true);
    } finally {
      await f.dispose();
    }
  });
  it("executes an informational workflow message as a local action without an AI attempt or recipient task", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const team = (await f.module.actions.catalogue.list()).valid.find(
        (entry) => entry.definition.id === "team",
      )!;
      if (team.definition.schema !== "team/v1")
        throw new Error("Expected team.");
      await f.module.actions.catalogue.save(
        { ...team.definition, allowedRecipients: ["team"] },
        team.revision,
      );
      const project = f.studio
        .state()
        .projects!.find((item) => item.id === f.projectId)!;
      if (!f.app.vault.getAbstractFileByPath("CoForge/Projects"))
        await f.app.vault.createFolder("CoForge/Projects");
      await f.app.vault.create(
        "CoForge/Projects/Project.md",
        `---\n${stringify(projectProperties(project))}---\n${projectBody(project)}`,
      );
      const definition = workflowV2DefinitionCheck({
        format: "coforge-workflow/v2",
        revision: "message-workflow",
        name: "Share note",
        subjectMode: "note",
        teamId: "team",
        collections: [],
        limits: {
          timeoutSeconds: 30,
          maxTurns: 1,
          maxBudgetUsd: 1,
          maxInvocations: 10,
        },
        steps: [
          {
            kind: "message",
            id: "share",
            name: "Share information",
            instructions: "",
            purpose: "information",
            recipientId: "team",
            body: "For the next run: {{source}}",
            inputs: [],
          },
        ],
      });
      await f.module.actions.workflows.save(f.projectId, definition, undefined);
      const run = await f.module.actions.workflows.start(
        f.projectId,
        "Private/Proposal.md",
        false,
      );
      await f.module.actions.resume();
      await vi.advanceTimersByTimeAsync(1000);
      const completed = f.module.actions
        .snapshot()
        .runs.find((item) => item.id === run.id)!;
      expect(completed.state).toBe("completed");
      expect(completed.attempts).toEqual([]);
      expect(completed.artifacts).toEqual([]);
      const messages = f.module.actions.messages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        status: "delivered",
        message: { purpose: "information", startsRun: false },
      });
      expect(messages[0]?.message.body).toContain("The original proposal.");
      expect(f.module.actions.snapshot().runs).toHaveLength(1);
    } finally {
      await f.dispose();
    }
  });
  it("blocks the next council action when membership is revoked while retaining its published opinion", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const team = (await f.module.actions.catalogue.list()).valid.find(
        (entry) => entry.definition.id === "team",
      )!;
      if (team.definition.schema !== "team/v1")
        throw new Error("Expected team.");
      await f.module.actions.catalogue.save(
        defaultCouncilDefinition("council", "Council", team.definition, [
          "agent",
        ]),
      );
      const run = await f.module.actions.simulate(
        { kind: "council", id: "council", teamId: "team" },
        "Private/Proposal.md",
        "CoForge/Tests/Revoked.md",
      );
      await f.module.actions.resume();
      await vi.advanceTimersByTimeAsync(800);
      expect(
        f.module.actions.snapshot().runs.find((item) => item.id === run.id)
          ?.artifacts,
      ).toHaveLength(1);
      await f.module.actions.catalogue.save(
        { ...team.definition, members: [] },
        team.revision,
      );
      await vi.advanceTimersByTimeAsync(1000);
      const blocked = f.module.actions
        .snapshot()
        .runs.find((item) => item.id === run.id)!;
      expect(blocked.state).toBe("attention");
      expect(blocked.attempts).toHaveLength(1);
      expect(blocked.artifacts).toHaveLength(1);
    } finally {
      await f.dispose();
    }
  });
  it("persists project pause and keeps a selected simulation queued until resumed", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const run = await f.module.actions.simulate(
        f.target,
        "Private/Proposal.md",
        "CoForge/Tests/Paused.md",
      );
      await f.module.actions.pauseProject(f.projectId, true);
      await f.module.actions.resume();
      await vi.advanceTimersByTimeAsync(2000);
      expect(
        f.module.actions.snapshot().runs.find((item) => item.id === run.id)
          ?.attempts,
      ).toEqual([]);
      expect(f.module.actions.snapshot().preferences.pausedProjectIds).toEqual([
        f.projectId,
      ]);
      await f.module.actions.pauseProject(f.projectId, false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(
        f.module.actions.snapshot().runs.find((item) => item.id === run.id)
          ?.state,
      ).toBe("completed");
    } finally {
      await f.dispose();
    }
  });
  it("requires a source-change acknowledgement and then retains the original captured prompt", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const run = await f.module.actions.simulate(
        f.target,
        "Private/Proposal.md",
        "CoForge/Tests/Changed.md",
      );
      const file = f.app.vault.getFileByPath("CoForge/Tests/Changed.md")!;
      await f.app.vault.modify(
        file,
        `${await f.app.vault.read(file)}\nNew direction.\n`,
      );
      await f.module.actions.resume();
      await vi.advanceTimersByTimeAsync(1000);
      expect(
        f.module.actions.snapshot().runs.find((item) => item.id === run.id)
          ?.state,
      ).toBe("attention");
      await f.module.actions.continueSnapshot(run.id);
      await vi.advanceTimersByTimeAsync(1000);
      const completed = f.module.actions
        .snapshot()
        .runs.find((item) => item.id === run.id)!;
      expect(completed.state).toBe("completed");
      expect(completed.subject.markdown).toContain("The original proposal.");
      expect(completed.attempts[0]?.dispatch.prompt).not.toContain(
        "New direction.",
      );
      expect(await f.app.vault.read(file)).toContain("New direction.");
    } finally {
      await f.dispose();
    }
  });
  it("fences a formerly designated desktop before source, projection or journal mutations", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    try {
      const run = await f.module.actions.simulate(
        f.target,
        "Private/Proposal.md",
        "CoForge/Tests/Original.md",
      );
      const directory = ".obsidian/plugins/coforge";
      const settingsPath = `${directory}/coforge-council-settings.json`;
      const journalPath = `${directory}/coforge-execution-v2.json`;
      const before = await f.app.vault.adapter.read(journalPath);
      const current = record(
        JSON.parse(await f.app.vault.adapter.read(settingsPath)),
      );
      await f.app.vault.adapter.write(
        settingsPath,
        JSON.stringify({
          ...current,
          executorId: "another-desktop",
          revision: Number(current.revision) + 1,
        }),
      );
      await expect(f.module.actions.cancel(run.id)).rejects.toThrow(
        "Designate this desktop",
      );
      await expect(
        f.module.actions.simulate(
          f.target,
          "Private/Proposal.md",
          "CoForge/Tests/Blocked.md",
        ),
      ).rejects.toThrow("Designate this desktop");
      expect(
        f.app.vault.getAbstractFileByPath("CoForge/Tests/Blocked.md"),
      ).toBeNull();
      expect(await f.app.vault.adapter.read(journalPath)).toBe(before);
      expect(f.kit.read("Private/Proposal.md")).toBe(
        "The original proposal.\n",
      );
    } finally {
      await f.dispose();
    }
  });
});
