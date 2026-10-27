import { reactive, ref } from "vue";
import {
  STREAM_SURFACES,
  type StreamSurface,
} from "../../../features/coforge/domain/stream-surfaces";
import { useCoforge } from "../../context/coforge-context";
export function useStreamDisplays() {
  const { host, studio } = useCoforge();
  const preview = ref<StreamSurface | null>(null);
  const error = ref("");
  return reactive({
    definitions: STREAM_SURFACES,
    preview,
    error,
    source: host.streamSource,
    canOpen: Boolean(host.streamViews),
    open: (surface: StreamSurface) => {
      error.value = "";
      void host.streamViews?.open(surface).catch(() => {
        error.value =
          "The detached view could not be opened. Use desktop Obsidian and check its workspace.";
      });
    },
    showProject: () => {
      const id = studio.state().activeProjectId;
      if (id)
        void host.streamViews?.showProject(id).catch(() => {
          error.value =
            "The stream project could not be changed. Review the selected project and try again.";
        });
    },
    showPreview: (surface: StreamSurface) => {
      preview.value = surface;
    },
    closePreview: () => {
      preview.value = null;
    },
  });
}
