import type { Plugin } from "obsidian";
import type { StudioStore } from "../../features/coforge/application/studio-store";
/** Host-owned status UI has its own narrow projection; no view-local Pinia store or embedded footer. */
export function mountNativeStatusbar(
  plugin: Plugin,
  store: StudioStore,
): () => void {
  const item = plugin.addStatusBarItem();
  item.classList.add("coforge-native-statusbar");
  item.textContent = `${plugin.manifest.name}: loading`;
  item.setAttribute("role", "status");
  item.setAttribute("aria-live", "polite");
  item.setAttribute("aria-atomic", "true");
  let closed = false;
  const refresh = () => {
    if (closed || !store.ready) return;
    const status = store.nativeStatusSnapshot();
    const connection =
      status.twitch === "connected"
        ? "Chat connected"
        : status.twitch === "error"
          ? "Chat error"
          : status.twitch === "connecting" || status.twitch === "reconnecting"
            ? "Chat connecting"
            : "Chat offline";
    const agents = status.running
      ? `${status.running} running${status.queued ? ` / ${status.queued} queued` : ""}`
      : status.queued
        ? `${status.queued} queued`
        : "idle";
    const next = `${plugin.manifest.name} · ${connection} · ${agents}`;
    if (item.textContent === next) return;
    item.textContent = next;
    item.setAttribute(
      "title",
      `${plugin.manifest.name} · ${connection.replace(/^Chat/, "Twitch chat")} · ${agents}`,
    );
  };
  const stop = store.subscribeChanges(refresh);
  refresh();
  const dispose = () => {
    if (closed) return;
    closed = true;
    stop();
    item.remove();
  };
  plugin.register(dispose);
  return dispose;
}
