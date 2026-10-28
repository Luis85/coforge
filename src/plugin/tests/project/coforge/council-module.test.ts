// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilModule } from "../../../infrastructure/coforge/council-module";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { StudioService } from "../../../features/coforge/application/studio";
import { createSeed } from "../../../features/coforge/domain/seed";
import {
  defaultCouncilDefinition,
  type AgentDefinition,
  type TeamDefinition,
} from "../../../features/coforge/domain/council-definitions";
import { MemoryStorage, nodeTimers } from "./memory-storage";

afterEach(() => {
  vi.useRealTimers();
});
describe("Council vault composition", () => {
  it("executes three independent opinions then three complete solution inputs and preserves the original simulation source", async () => {
    vi.useFakeTimers();
    const app = new App();
    const original = "---\ncustom: keep\n---\n# Proposal\nBuild a lantern.\n";
    const kit = createTestApp({
      app,
      layoutReady: true,
      files: { "Private/Proposal.md": original },
    });
    class TestPlugin extends Plugin {}
    const plugin = new TestPlugin(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      author: "",
      description: "",
    });
    const timers = nodeTimers();
    const runner = vi.fn(async () => ({ markdown: "A result" }));
    const studio = new StudioService(new MemoryStorage(createSeed()), {
      timers,
      runners: { demo: runner, claude: runner },
      probeRuntime: async () => ({
        cliAvailable: false,
        projectPath: null,
        allowImplementation: false,
      }),
    });
    await studio.store.init();
    const module = new CouncilModule(
      plugin,
      studio,
      timers,
      new InvocationGate(),
    );
    await module.start();
    try {
      expect(module.actions.snapshot()).toMatchObject({
        ready: true,
        paused: true,
        executor: false,
      });
      await module.actions.designateExecutor();
      const projectId = studio.state().activeProjectId!;
      const members = ["product", "architect", "qa"];
      for (const id of members) {
        const agent: AgentDefinition = {
          schema: "agent/v1",
          id,
          name: id,
          enabled: true,
          role: id,
          instructions: `Act as ${id}`,
          provider: "demo",
          model: "sonnet",
          contextSources: [],
          requestedCapabilities: { project: "none", messaging: false },
        };
        await module.actions.catalogue.save(agent);
      }
      const team: TeamDefinition = {
        schema: "team/v1",
        id: "studio-team",
        name: "Studio",
        enabled: true,
        projectId,
        members,
        pinnedContext: [],
        recentMessages: 10,
        allowedRecipients: [],
      };
      await module.actions.catalogue.save(team);
      await module.actions.catalogue.save(
        defaultCouncilDefinition("design", "Design council", team, members),
      );
      const target = {
        kind: "council" as const,
        id: "design",
        teamId: team.id,
      };
      const preview = await module.actions.preflight(
        target,
        "Private/Proposal.md",
      );
      expect(preview.invocations).toBe(6);
      expect(module.actions.snapshot().runs).toHaveLength(0);
      expect(runner).not.toHaveBeenCalled();
      const submitted = await module.actions.simulate(
        target,
        "Private/Proposal.md",
        "CoForge/Tests/Design.md",
      );
      expect(module.actions.snapshot().runs[0]?.state).toBe("queued");
      await module.actions.resume();
      await vi.advanceTimersByTimeAsync(6000);
      const completed = module.actions
        .snapshot()
        .runs.find((run) => run.id === submitted.id)!;
      expect(completed.state).toBe("completed");
      expect(completed.artifacts).toHaveLength(6);
      expect(
        completed.attempts
          .slice(0, 3)
          .map((attempt) => attempt.dispatch.inputArtifactIds),
      ).toEqual([[], [], []]);
      for (const attempt of completed.attempts.slice(3))
        expect(attempt.dispatch.inputArtifactIds).toEqual(
          completed.artifacts.slice(0, 3).map((artifact) => artifact.id),
        );
      expect(completed.artifacts.every((artifact) => artifact.simulated)).toBe(
        true,
      );
      expect(kit.read("Private/Proposal.md")).toBe(original);
      expect(
        kit.read("CoForge/Tests/Design.md").match(/coforge:v2:.*:begin/g),
      ).toHaveLength(6);
      expect(kit.errors).toEqual([]);
    } finally {
      await module.dispose();
      await studio.stop();
    }
  });
});
