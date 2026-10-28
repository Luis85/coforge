import { defineStore } from "pinia";
import { ref } from "vue";
import type { CouncilRuntimeSnapshot } from "../../features/coforge/application/council-ports";
import type { CouncilCatalogueSnapshot } from "../../features/coforge/application/council-catalogue";
import type { CouncilPreflight } from "../../features/coforge/application/council-execution";
import type { IntakeCandidate } from "../../features/coforge/domain/intake-bindings";
import type { CouncilPage } from "./studio-pages";

export const useCouncilStore = defineStore("coforge-council", () => {
  const state = ref<CouncilRuntimeSnapshot | null>(null);
  const catalogue = ref<CouncilCatalogueSnapshot>({ valid: [], invalid: [] });
  const tab = ref<CouncilPage>("definitions");
  const source = ref("");
  const destination = ref("CoForge/Tests/");
  const target = ref("");
  const team = ref("");
  const preview = ref<CouncilPreflight | null>(null);
  const inboxPreview = ref<IntakeCandidate[]>([]);
  const inboxSelection = ref<string[]>([]);
  const bindingId = ref("");
  const editingBindingId = ref("");
  const inboxPreviewed = ref(false);
  const inboxKind = ref<"agent-council" | "workflow" | "team">("agent-council");
  const resetInboxId = ref("");
  const resetInboxConfirmed = ref(false);
  const inboxPath = ref("");
  const recursive = ref(false);
  const readyOnly = ref(false);
  const busy = ref(false);
  const error = ref("");
  const notice = ref("");
  const projectFilter = ref("");
  const stateFilter = ref("");
  const inspectedRun = ref("");
  const teamFilter = ref("");
  const targetFilter = ref("");
  const sourceFilter = ref("");
  const skipReason = ref("");
  const acknowledge = ref(false);
  const checkpointItems = ref<string[]>([]);
  const checkpointNote = ref("");
  const exportedRun = ref("");
  const reassignPath = ref("");
  const pruneConsent = ref(false);
  const handoffIdeaId = ref("");
  const handoffArtifactId = ref("");
  const allowanceCalls = ref(0);
  const allowanceMinutes = ref(0);
  const allowanceScope = ref("");
  const allowanceReason = ref("");
  return {
    state,
    catalogue,
    tab,
    source,
    destination,
    target,
    team,
    preview,
    inboxPreview,
    inboxSelection,
    bindingId,
    editingBindingId,
    inboxPreviewed,
    inboxKind,
    resetInboxId,
    resetInboxConfirmed,
    inboxPath,
    recursive,
    readyOnly,
    busy,
    error,
    notice,
    projectFilter,
    stateFilter,
    inspectedRun,
    teamFilter,
    targetFilter,
    sourceFilter,
    skipReason,
    acknowledge,
    checkpointItems,
    checkpointNote,
    exportedRun,
    reassignPath,
    pruneConsent,
    handoffIdeaId,
    handoffArtifactId,
    allowanceCalls,
    allowanceMinutes,
    allowanceScope,
    allowanceReason,
  };
});
