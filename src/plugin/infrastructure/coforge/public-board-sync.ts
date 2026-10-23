import type { StudioService } from '../../features/coforge/application/studio';
import type { PublicSitePublisher } from './public-site-publisher';

const DEBOUNCE_MS = 3000;

/**
 * Keeps the public board files current while "Keep the viewer board updated" is enabled.
 * Changes are debounced and written one at a time; a failure is reported once until a write succeeds again.
 */
export function syncPublicBoard(studio: StudioService, publisher: PublicSitePublisher, onError: (error: unknown) => void): () => void {
  let timer: number | undefined;
  let running: Promise<unknown> = Promise.resolve();
  let failing = false;
  const flush = () => {
    timer = undefined;
    const integration = studio.integration();
    if (!integration.publicBoardEnabled) return;
    const state = studio.state();
    running = running.then(() => publisher.publish(state, integration.publicFolder))
      .then(() => { failing = false; }, (error: unknown) => { if (!failing) onError(error); failing = true; });
  };
  const schedule = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(flush, DEBOUNCE_MS);
  };
  const stopState = studio.subscribe(schedule);
  const stopIntegration = studio.onIntegrationChange(schedule);
  return () => {
    stopState(); stopIntegration();
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
