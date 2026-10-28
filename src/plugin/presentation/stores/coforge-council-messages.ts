import { defineStore } from "pinia";
import type { MessageOutboxEntry } from "../../features/coforge/domain/team-messages";

export const useCouncilMessageStore = defineStore("coforge-council-messages", {
  state: () => ({
    draft: "",
    busy: false,
    error: "",
    notice: "",
    entries: [] as MessageOutboxEntry[],
  }),
});
