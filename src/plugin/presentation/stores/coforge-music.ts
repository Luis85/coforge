import { defineStore } from "pinia";
import { ref } from "vue";
import { emptyMusic } from "../../features/coforge/domain/music";
export const useMusicStore = defineStore("coforge-music", () => {
  const state = ref(emptyMusic());
  const folder = ref("");
  const selected = ref("");
  const name = ref("");
  const tracks = ref<string[]>([]);
  const version = ref<string>();
  const search = ref("");
  const error = ref("");
  const notice = ref("");
  const example = ref(false);
  return {
    state,
    folder,
    selected,
    name,
    tracks,
    version,
    search,
    error,
    notice,
    example,
  };
});
