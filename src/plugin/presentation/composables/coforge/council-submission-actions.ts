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
          store.inspectedRun = saved.id;
          store.tab = "monitor";
          store.notice = "Submission retained. Resume execution when ready.";
        } catch (error) {
          store.preview = null;
          throw error;
        }
      }),
    simulate: () =>
      host.run(async () => {
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
          store.inspectedRun = saved.id;
          store.tab = "monitor";
          store.notice =
            "Simulation queued at the selected test destination. Resume to produce marked fake output.";
        } catch (error) {
          store.preview = null;
          throw error;
        }
      }),
  };
}
