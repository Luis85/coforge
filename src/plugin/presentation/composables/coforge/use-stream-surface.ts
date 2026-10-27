import { onBeforeUnmount } from "vue";
import type { StreamSurfaceSource } from "../../../features/coforge/application/stream-surface-ports";
import type { StreamSurface } from "../../../features/coforge/domain/stream-surfaces";
import { createStreamSurfaceStore } from "../../stores/coforge-stream-surface";
export function useStreamSurface(props: {
  surface: StreamSurface;
  source: StreamSurfaceSource;
}) {
  const store = createStreamSurfaceStore(props);
  onBeforeUnmount(store.dispose);
  return store;
}
