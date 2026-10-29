import type { CouncilActions } from "../../../features/coforge/application/council-ports";
import type { CouncilTarget } from "../../../features/coforge/application/council-execution";
import { reviewedCouncilIdentity } from "../../../features/coforge/application/reviewed-preflight";
import type { useCouncilStore } from "../../stores/coforge-council";

export function councilSubmissionActions(host: {
  store: ReturnType<typeof useCouncilStore>;
  service(): Pick<CouncilActions, "preflight" | "submit" | "simulate">;
  target(): CouncilTarget;
  projectId(): string;
  closed(): boolean;
  run(work: () => Promise<void>): Promise<void>;
}) {
  const { store } = host;
  function showAdmitted(id: string, asking: boolean, message: string) {
    store.inspectedRun = id;
    if (!asking) store.tab = 'monitor';
    else {
      if (store.taskReviewDraftKey === store.taskDraftKey) {
        store.taskConfirmedSavedDraftKey = '';
        store.taskReviewDraftKey = '';
        store.taskLinkedIdea = null;
        store.taskTitle = '';
        store.taskQuestion = '';
        store.taskDraftKey = crypto.randomUUID();
        store.taskProjectId = host.projectId();
      }
      store.preview = null;
      store.taskSource = '';
    }
    store.notice = message;
  }
  return {
    preflight: () =>
      host.run(async () => {
        const source = store.source;
        const destination = host.target();
        const projectId = host.projectId();
        const preview = await host.service().preflight(destination, source);
        if (
          host.closed() ||
          projectId !== host.projectId() ||
          source !== store.source ||
          destination.id !== store.target ||
          destination.teamId !== store.team
        )
          return;
        store.preview = preview;
        store.notice =
          "Preflight complete. No provider was contacted and no message was sent.";
      }),
    submit: () =>
      host.run(async () => {
        const asking = store.tab === "ask";
        if (!store.preview)
          throw new Error("Run preflight before submitting this note.");
        try {
          const saved = await host
            .service()
            .submit(
              host.target(),
              store.source,
              reviewedCouncilIdentity(store.preview),
            );
          showAdmitted(saved.id, asking, 'Submission retained in task history. Resume execution when ready.');
        } catch (error) {
          store.preview = null;
          throw error;
        }
      }),
    simulate: () =>
      host.run(async () => {
        const asking = store.tab === 'ask';
        try {
          const saved = await host
            .service()
            .simulate(
              host.target(),
              store.source,
              store.destination,
              store.preview
                ? reviewedCouncilIdentity(store.preview)
                : undefined,
            );
          showAdmitted(saved.id, asking, 'Simulation queued at the selected test destination. Resume to produce marked fake output.');
        } catch (error) {
          store.preview = null;
          throw error;
        }
      }),
  };
}
