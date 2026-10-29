import type { ObsShowExecutor } from './obs-show-ports';
import type { ObsShowStep } from '../domain/obs-show';
import type { ObsProductionActions } from './obs-production-workflow';
import type { ObsSceneActions } from '../domain/obs-scenes';
import { IntegrationFailure } from '../domain/integration-failure';
/** Resolves every explicit target against a fresh connection context; no dynamic private note text is inserted. */
export class ObsShowProductionExecutor implements ObsShowExecutor {
  constructor(private readonly production: Pick<ObsProductionActions, 'inspect' | 'execute'>, private readonly scenes: Pick<ObsSceneActions, 'execute'>, private readonly isLive: () => boolean, private readonly isReady: () => boolean = isLive, private readonly afterInteraction: () => Promise<void> = () => Promise.resolve(), private readonly refreshOverlay?: (id: string) => Promise<unknown>) {}
  live(): boolean { return this.isLive(); }
  ready(): boolean { return this.isReady(); }
  settle(): Promise<void> { return this.afterInteraction(); }
  async execute(step: ObsShowStep): Promise<void> {
    if (step.kind === 'overlay') {
      if (!this.refreshOverlay) throw new IntegrationFailure('validation', 'Public overlay controls are unavailable.');
      await this.refreshOverlay(step.overlayId);
      return;
    }
    const snapshot = await this.production.inspect();
    const expected = snapshot.context;
    switch (step.kind) {
      case 'scene': await this.scenes.execute({ kind: 'scene-switch', sceneId: step.sceneId, expected }); return;
      case 'source-visible': await this.scenes.execute({ kind: 'item-visible', sceneId: step.sceneId, itemId: step.itemId, enabled: step.enabled, expected }); return;
      case 'mute': await this.production.execute({ kind: 'input-mute', inputId: step.inputId, muted: step.muted, expected }); return;
      case 'volume': await this.production.execute({ kind: 'input-volume', inputId: step.inputId, volumeDb: step.volumeDb, expected }); return;
      case 'record': await this.production.execute({ kind: `record-${step.action}`, expected }); return;
      case 'replay-save': await this.production.execute({ kind: 'replay-save', expected }); return;
      case 'media': await this.production.execute({ kind: 'media-action', inputId: step.inputId, action: step.action, expected }); return;
      case 'transition': {
        await this.production.execute({ kind: 'preview-scene', sceneId: step.sceneId, expected });
        const fresh = await this.production.inspect();
        await this.production.execute({ kind: 'transition', name: step.name, duration: step.duration, expected: fresh.context });
        return;
      }
      case 'marker': return;
    }
  }
}
