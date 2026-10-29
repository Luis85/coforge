import { reactive, ref } from "vue";
import {
  STREAM_SURFACES,
  type StreamSurface,
} from "../../../features/coforge/domain/stream-surfaces";
import { useCoforge } from "../../context/coforge-context";
import { useTemporaryExample } from "./use-temporary-example";
export function useStreamDisplays() {
  const { host, studio } = useCoforge();
  const preview = ref<StreamSurface | null>(null);
  const error = ref("");
  const beginExample = useTemporaryExample("public-displays", () => {
    preview.value = null;
  });
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
          "The public tab could not be opened. Open a main workspace tab and try again.";
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
      beginExample();
      preview.value = surface;
    },
    closePreview: () => {
      preview.value = null;
    },
  });
}
