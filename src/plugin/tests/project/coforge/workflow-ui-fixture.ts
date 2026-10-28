import { createPinia, disposePinia } from "pinia";
import type { Plugin } from "vue";
import { vi } from "vitest";
import { StudioService } from "../../../features/coforge/application/studio";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { MemoryStorage, nodeTimers } from "./memory-storage";
export async function workflowUiFixture() {
  const storage = new MemoryStorage();
  const runner = vi.fn(async () => ({}));
  const studio = new StudioService(storage, {
    timers: nodeTimers(),
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.start();
  const project = await studio.createProject({
    projectName: "Workflow UI fixture",
    projectBrief: "Canonical configuration for the workflow editor.",
    projectPath: "/synthetic/workflow",
  });
  const pinia = createPinia();
  const store = useStudioStore(pinia);
  store.state = studio.state();
  const stop = studio.subscribe((value) => {
    store.state = value;
  });
  const saveExport = vi.fn(async (_json: string) => "private-workflow.json");
  const context: CoforgeContext = {
    studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => false,
      saveExport,
      publishBoard: async () => ({ folder: "", changed: false }),
      installPagesWorkflow: async () => ({
        folder: "",
        workflow: "",
        created: false,
      }),
    },
  };
  const provider: Plugin = {
    install(app) {
      app.provide(coforgeKey, context);
    },
  };
  return {
    storage,
    runner,
    studio,
    project,
    store,
    pinia,
    provider,
    saveExport,
    dispose: async () => {
      stop();
      store.dispose();
      disposePinia(pinia);
      await studio.stop();
    },
  };
}
