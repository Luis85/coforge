import { computed } from "vue";
import {
  AGENT_CONNECTION_PROFILES,
  agentConnectionProfileIssue,
} from "../../../features/coforge/domain/agent-connection-profiles";
import type { useCouncilEditorStore } from "../../stores/coforge-council-editor";

export function useCouncilConnectionForm(
  store: ReturnType<typeof useCouncilEditorStore>,
) {
  return {
    connectionProfiles: computed(() =>
      AGENT_CONNECTION_PROFILES.filter(
        (profile) =>
          store.draft?.schema === "agent/v1" &&
          profile.provider === store.draft.provider,
      ),
    ),
    profileIssue: computed(() =>
      store.draft?.schema === "agent/v1"
        ? agentConnectionProfileIssue(store.draft)
        : "",
    ),
  };
}
