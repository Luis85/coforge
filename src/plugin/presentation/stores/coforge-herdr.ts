import { defineStore } from "pinia";
import { ref } from "vue";
import {
  emptyHerdr,
  type HerdrReview,
  type HerdrAgent,
} from "../../features/coforge/domain/herdr";
export const useHerdrStore = defineStore("coforge-herdr", () => {
  const state = ref(emptyHerdr());
  const executable = ref("");
  const session = ref("");
  const workspace = ref("");
  const pane = ref("");
  const agent = ref("");
  const request = ref("");
  const provider = ref("claude");
  const review = ref<HerdrReview | null>(null);
  const error = ref("");
  const notice = ref("");
  const example = ref(false);
  const interruptConfirm = ref<HerdrAgent | null>(null);
  return {
    state,
    executable,
    session,
    workspace,
    pane,
    agent,
    request,
    provider,
    review,
    error,
    notice,
    example,
    interruptConfirm,
  };
});
