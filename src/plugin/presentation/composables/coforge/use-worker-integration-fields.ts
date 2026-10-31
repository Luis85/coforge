import { computed, reactive } from "vue";
import { usePluginSettingsForm } from "./use-plugin-settings";
import type { ExecutionConcurrency } from "../../../features/coforge/domain/execution-concurrency";

export function useWorkerIntegrationFields() {
  const model = usePluginSettingsForm();
  const field = (key: keyof ExecutionConcurrency) =>
    computed({
      get: () => model.draft.executionConcurrency?.[key] ?? 1,
      set: (value) => {
        model.draft.executionConcurrency = {
          builds: model.draft.executionConcurrency?.builds ?? 1,
          shortTasks: model.draft.executionConcurrency?.shortTasks ?? 1,
          [key]: Number(value),
        };
      },
    });
  return reactive({ builds: field("builds"), shortTasks: field("shortTasks") });
}
