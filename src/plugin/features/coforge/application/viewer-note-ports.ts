import type { ViewerNote } from "../domain/viewer-notes";
export interface ViewerNoteStorage {
  save(profile: ViewerNote): Promise<void>;
  open(id: string): Promise<void>;
  refreshIndex?(): Promise<void>;
}
export interface ViewerNoteActions {
  open(id: string): Promise<void>;
  refresh(): Promise<void>;
  status(): { pending: number; saved: number; failed: boolean };
}
