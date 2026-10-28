import { addIcon, removeIcon, type Plugin } from "obsidian";
import type { StreamSurface } from "../../features/coforge/domain/stream-surfaces";

/** One monitor silhouette identifies public displays; the inset glyph distinguishes each read-only view. */
const GLYPHS: Record<StreamSurface, string> = {
  kanban: '<path d="M30 30v26m20-26v16m20-16v22"/>',
  chat: '<path d="M29 28h42v23H48L37 60v-9h-8z"/><path d="M38 37h24m-24 7h15"/>',
  leaderboards: '<path d="M31 56V44h12v12m1 0V29h12v27m1 0V37h12v19"/>',
  community:
    '<circle cx="50" cy="34" r="8"/><path d="M34 59c0-15 32-15 32 0M28 34a6 6 0 0 0 0 12m44-12a6 6 0 0 1 0 12"/>',
};
export function registerStreamIcons(plugin: Plugin): void {
  for (const [surface, glyph] of Object.entries(GLYPHS)) {
    const id = `coforge-stream-${surface}`;
    addIcon(
      id,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="14" width="76" height="57" rx="7"/><path d="M38 86h24M50 71v15"/>${glyph}</svg>`,
    );
    plugin.register(() => removeIcon(id));
  }
}
