import type { CouncilActions } from "../../../features/coforge/application/council-ports";
import type { useCouncilStore } from "../../stores/coforge-council";

/** Independent read failures preserve the last known catalogue and saved task list. */
export async function refreshCouncil(
  service: CouncilActions,
  store: ReturnType<typeof useCouncilStore>,
  current: () => boolean,
) {
  store.catalogueLoaded = false;
  store.catalogueLoading = true;
  store.catalogueError = '';
  try {
  store.state = service.snapshot();
  const [catalogue, tasks] = await Promise.allSettled([
    service.catalogue.list(),
    service.listTasks(),
  ]);
  if (!current()) return;
  if (catalogue.status === "fulfilled") { store.catalogue = catalogue.value; store.catalogueLoaded = true; }
  if (tasks.status === "fulfilled") {
    store.tasks = tasks.value;
    store.tasksLoaded = true;
    store.taskHistoryError = "";
  } else
    store.taskHistoryError =
      "Saved task notes could not be refreshed. The last known list is kept; retained runs remain visible. Refresh Council to retry.";
  if (catalogue.status === "rejected") {
    store.catalogueError = 'Council configuration is unavailable. Refresh Council to retrieve saved definitions before reviewing recipients.';
    throw new Error(
      "Council definitions could not be refreshed. The last known catalogue is kept; refresh before relying on it.",
    );
  }
  if (tasks.status === "rejected") throw new Error(store.taskHistoryError);
  } finally { if (current()) store.catalogueLoading = false; }
}
