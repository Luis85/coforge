import type { Plugin } from "obsidian";
import type { StudioStore } from "../../features/coforge/application/studio-store";
/** Host-owned status UI has its own narrow projection; no view-local Pinia store or embedded footer. */
export function mountNativeStatusbar(
  plugin: Plugin,
  store: StudioStore,
  failure: () => void,
): () => void {
  const item = plugin.addStatusBarItem();
  item.classList.add("coforge-native-statusbar");
  const button = item.createEl("button", {
    text: `${plugin.manifest.name}: loading`,
    attr: {
      type: "button",
      "aria-label": "Open studio",
      title: "Open studio",
    },
  });
  let closed = false;
  const refresh = () => {
    if (closed || !store.ready) return;
    const status = store.nativeStatusSnapshot();
    const connection =
      status.twitch === "connected"
        ? "Twitch connected"
        : status.twitch === "error"
          ? "Twitch needs attention"
          : "Twitch offline";
    const agents = status.running
      ? `${status.running} AI task${status.running === 1 ? "" : "s"} running`
      : status.queued
        ? `${status.queued} AI tasks queued`
        : "Workflow idle";
    button.textContent = `CoForge · ${connection} · ${agents}`;
  };
  const open = () => {
    void (async () => {
      const type = `${plugin.manifest.id}-view-project-workbench`;
      const leaf =
        plugin.app.workspace
          .getLeavesOfType(type)
          .find(
            (leaf) =>
              leaf.view.containerEl.ownerDocument === item.ownerDocument,
          ) ?? plugin.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type, active: true });
      await plugin.app.workspace.revealLeaf(leaf);
    })().catch(failure);
  };
  button.addEventListener("click", open);
  const stop = store.subscribeChanges(refresh);
  refresh();
  const dispose = () => {
    if (closed) return;
    closed = true;
    stop();
    button.removeEventListener("click", open);
    item.remove();
  };
  plugin.register(dispose);
  return dispose;
}
