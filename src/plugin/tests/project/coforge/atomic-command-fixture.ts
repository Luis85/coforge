import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { StudioService } from "../../../features/coforge/application/studio";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { parsePersistedStudio } from "../../../features/coforge/domain/persisted";
import type { AtomicCommandJournal } from "../../../infrastructure/coforge/atomic-command-format";
import { nodeTimers } from "./memory-storage";
export async function atomicCommandFixture() {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    description: "",
    author: "",
  });
  const storage = new VaultStudioStorage(plugin);
  const studio = new StudioService(storage, {
    timers: nodeTimers(),
    runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.store.init();
  await studio.createProject({
    projectName: "Command project",
    projectBrief: "A project for paid viewer commands.",
    projectPath: "/synthetic/command-project",
  });
  return { app, kit, plugin, storage, studio };
}
export async function atomicExistingFixture() {
  const f = await atomicCommandFixture();
  await f.studio.createIdea({
    username: "Owner",
    category: "Gameplay",
    title: "Existing request",
    description: "Preserve the request description.",
  });
  const idea = f.studio.state().ideas[0]!;
  const file = f.storage.file(idea.id)!;
  return { ...f, idea, file };
}
export function preparedJournal(
  f: Awaited<ReturnType<typeof atomicExistingFixture>>,
): AtomicCommandJournal {
  const beforeData = f.kit.read(f.storage.dataPath);
  const after = parsePersistedStudio(JSON.parse(beforeData));
  after.ingestMeta.processedMessages.push({
    id: "frozen-event-outcome",
    ideaId: f.idea.id,
  });
  return {
    format: "coforge-command-commit/v1",
    recoveryId: "12345678-1234-1234-1234-123456789abc",
    folder: "CoForge/Ideas",
    beforeData,
    afterData: JSON.stringify(after, null, 2),
    notes: [
      {
        id: f.idea.id,
        path: f.file.path,
        before: f.kit.read(f.file.path),
        after: f.kit.read(f.file.path).replace("votes: 0", "votes: 1"),
      },
    ],
  };
}
