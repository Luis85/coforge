import type {
  StreamSurface,
  StreamSurfaceSnapshot,
} from "../domain/stream-surfaces";
export interface StreamSurfaceSource {
  snapshot(): StreamSurfaceSnapshot;
  subscribe(listener: (state: StreamSurfaceSnapshot) => void): () => void;
}
export interface StreamViewActions {
  open(surface: StreamSurface): Promise<void>;
  showProject(projectId: string): Promise<void>;
}
