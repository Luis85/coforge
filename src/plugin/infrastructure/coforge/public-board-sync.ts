import type { StudioService } from "../../features/coforge/application/studio";
import type { AppState } from "../../features/coforge/domain/types";
import type { PublicSitePublisher } from "./public-site-publisher";

const DEBOUNCE_MS = 3000;

/** Privacy revocation is immediate and independent of optional debounced public export updates. */
export function syncPublicBoard(
  studio: StudioService,
  publisher: PublicSitePublisher,
  onError: (error: unknown) => void,
): () => void {
  let timer: number | undefined;
  let failing = false;
  let stopped = false;
  let observed: AppState | null = null;
  const failed = (error: unknown) => {
    if (!failing) {
      try {
        onError(error);
      } catch {
        /* Diagnostics cannot undo privacy revocation or escape a background observer. */
      }
    }
    failing = true;
  };
  const flush = () => {
    timer = undefined;
    if (stopped || !studio.integration().publicBoardEnabled) return;
    void publisher
      .publishCurrent(
        () => studio.state(),
        () => studio.integration().publicFolder,
        () => !stopped && studio.integration().publicBoardEnabled,
      )
      .then(() => {
        failing = false;
      }, failed);
  };
  const schedule = () => {
    if (stopped) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(flush, DEBOUNCE_MS);
  };
  const stopState = studio.subscribe((state) => {
    const previous = observed;
    observed = state;
    const newlyDenied =
      previous &&
      (state.runtime.publicationDeniedProjectIds ?? []).some(
        (id) => !previous.runtime.publicationDeniedProjectIds?.includes(id),
      );
    if (!stopped && previous && newlyDenied)
      void publisher.beforeCommit(state, previous).then((release) => {
        release?.();
        failing = false;
      }, failed);
    schedule();
  });
  const stopIntegration = studio.onIntegrationChange(schedule);
  return () => {
    stopped = true;
    stopState();
    stopIntegration();
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
