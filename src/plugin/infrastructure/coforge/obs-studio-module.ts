import type { StudioStore } from "../../features/coforge/application/studio-store";
import type { ObsControlPort } from "../../features/coforge/application/obs-port";
import type { ObsWorkflow } from "../../features/coforge/application/obs-workflow";
import { ObsProductionWorkflow } from "../../features/coforge/application/obs-production-workflow";
import { ObsShowWorkflow } from "../../features/coforge/application/obs-show-workflow";
import { ObsShowProductionExecutor } from "../../features/coforge/application/obs-show-executor";
import { ObsSetupWorkflow } from "../../features/coforge/application/obs-setup-workflow";
import { ObsOverlayWorkflow } from '../../features/coforge/application/obs-overlay-workflow';

/** One native composition for all OBS writers; the application owns effects and recovery. */
export function createObsStudioModule(
  store: StudioStore,
  control: ObsControlPort,
  workflow: ObsWorkflow,
) {
  if (!control.production || !workflow.sceneActions)
    throw new Error("OBS production capabilities are unavailable.");
  const production = new ObsProductionWorkflow(
    store,
    control.production,
    workflow.productionGate(),
  );
  const isReady = () => {
    const obs = store.snapshot().runtime.obs;
    return Boolean(
      obs?.connection === "connected" &&
      !obs.uncertain &&
      !obs.busy &&
      obs.snapshot &&
      !obs.snapshot.reconnecting &&
      !obs.snapshot.transitioning &&
      Date.now() - Date.parse(obs.snapshot.observedAt) >= 0 &&
      Date.now() - Date.parse(obs.snapshot.observedAt) <= 30_000,
    );
  };
  const isLive = () =>
    isReady() && Boolean(store.snapshot().runtime.obs?.snapshot?.active);
  const overlays = new ObsOverlayWorkflow(store, production);
  const show = new ObsShowWorkflow(
    store,
    new ObsShowProductionExecutor(
      production,
      workflow.sceneActions,
      isLive,
      isReady,
      () => workflow.afterCurrentInteraction(),
      id => overlays.refreshOverlay(id),
    ),
  );
  const setup = new ObsSetupWorkflow(
    store,
    production,
    workflow.sceneActions,
    workflow,
  );
  let disposed = false;
  return {
    production,
    scenes: workflow.sceneActions,
    show,
    setup,
    overlays,
    async start() {
      if (disposed) return;
      await setup.start();
      if (disposed) {
        setup.dispose();
        return;
      }
      await show.start();
      if (disposed) {
        setup.dispose();
        show.dispose();
        return;
      }
      await overlays.start();
      if (disposed) overlays.dispose();
    },
    dispose() {
      disposed = true;
      overlays.dispose();
      setup.dispose();
      show.dispose();
    },
  };
}
