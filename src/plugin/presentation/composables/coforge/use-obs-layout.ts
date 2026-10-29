import { computed, reactive } from "vue";
import { useObsProduction } from "./use-obs-production";
export function useObsLayout() {
  const production = useObsProduction();
  function position(event: MouseEvent) {
    const target = event.currentTarget;
    const value = production.ui.transform;
    const video = production.ui.snapshot?.video;
    if (!(target instanceof HTMLElement) || !value || !video) return;
    const bounds = target.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    value.positionX = Math.round(
      (Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) /
        bounds.width) *
        video.baseWidth,
    );
    value.positionY = Math.round(
      (Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)) /
        bounds.height) *
        video.baseHeight,
    );
  }
  return reactive({
    production,
    position,
    items: computed(() =>
      production.studio.obsEditorDetail?.sceneId === production.ui.selectedScene
        ? production.studio.obsEditorDetail.items
        : [],
    ),
    point: computed(() => {
      const value = production.ui.transform;
      const video = production.ui.snapshot?.video;
      return value && video
        ? {
            left: `${(value.positionX / video.baseWidth) * 100}%`,
            top: `${(value.positionY / video.baseHeight) * 100}%`,
          }
        : {};
    }),
  });
}
