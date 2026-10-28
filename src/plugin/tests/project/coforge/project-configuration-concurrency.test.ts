import { afterEach, expect, it } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import { projectConfigurationIdentity } from "../../../features/coforge/domain/projects";
import { createSeed } from "../../../features/coforge/domain/seed";
import { MemoryStorage, nodeTimers } from "./memory-storage";
import type { StudioProject } from "../../../features/coforge/domain/types";
const services: StudioService[] = [];
afterEach(async () => {
  await Promise.all(services.splice(0).map((studio) => studio.stop()));
});
it("rejects a stale project draft after an earlier queued settings write commits", async () => {
  const storage = new MemoryStorage(createSeed());
  const studio = new StudioService(storage, {
    timers: nodeTimers(),
    runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  services.push(studio);
  await studio.start();
  const original = studio.state().projects![0]!;
  const expected = projectConfigurationIdentity(original);
  const first = studio.updateProject(
    { projectBrief: "Another editor changed the project description." },
    original.id,
  );
  const stale = studio.updateProject(
    {
      ...original.settings,
      stageAgents: { screen: { provider: "claude", model: "haiku" } },
    },
    original.id,
    expected,
  );
  const result = await Promise.allSettled([first, stale]);
  expect(result[0]?.status).toBe("fulfilled");
  expect(result[1]?.status).toBe("rejected");
  expect(studio.state().settings.projectBrief).toBe(
    "Another editor changed the project description.",
  );
  expect(studio.state().settings.stageAgents?.screen).toBeUndefined();
  const current = studio.state().projects![0]!;
  await studio.updateProject(
    { stageAgents: { screen: { provider: "demo" } } },
    current.id,
    projectConfigurationIdentity(current),
  );
  expect(studio.state().settings.stageAgents?.screen?.provider).toBe("demo");
});
it("compares configuration independent of timestamps and key order, but includes identity, settings, paths and links", () => {
  const project: StudioProject = {
    id: "CFP-001",
    settings: createSeed().settings,
    projectPath: "/game",
    worktreeFolder: "/worktrees",
    repositoryUrl: "https://example.test/repo",
    websiteUrl: "https://example.test",
    allowImplementation: false,
    createdAt: "2026-10-27T10:00:00Z",
    updatedAt: "2026-10-27T10:00:00Z",
  };
  const expected = projectConfigurationIdentity(project);
  expect(
    projectConfigurationIdentity({
      ...project,
      settings: {
        ...project.settings,
        automation: { implement: false, plan: true, score: true, screen: true },
      },
      createdAt: "2026-10-28T10:00:00Z",
      updatedAt: "2026-10-28T10:00:00Z",
    }),
  ).toBe(expected);
  for (const changed of [
    { ...project, id: "CFP-002" },
    { ...project, projectPath: "/other" },
    { ...project, repositoryUrl: "" },
    { ...project, settings: { ...project.settings, model: "opus" } },
  ])
    expect(projectConfigurationIdentity(changed)).not.toBe(expected);
});
