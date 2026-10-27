import { ItemView, type Plugin, type WorkspaceLeaf } from "obsidian";
import { createApp } from "vue";
import StreamSurfaceView from "../../presentation/components/coforge/StreamSurfaceView.vue";
import {
  STREAM_SURFACES,
  type StreamSurface,
} from "../../features/coforge/domain/stream-surfaces";
import type {
  StreamSurfaceSource,
  StreamViewActions,
} from "../../features/coforge/application/stream-surface-ports";
import { protectStreamWindow } from "./stream-window-privacy";

/** Stream roots receive only the public source contract, never CoForge's private UI context or host actions. */
export function registerStreamViews(
  plugin: Plugin,
  sourceForProject: (projectId: string) => {
    source: StreamSurfaceSource;
    dispose(): void;
  },
  currentProject: () => string,
  event: (
    kind: "stream-view-opened" | "stream-view-closed" | "stream-view-blocked",
    surface: StreamSurface,
  ) => Promise<void>,
  failure: () => void,
) {
  const mainDocument = plugin.app.workspace.containerEl.ownerDocument;
  const allowed = new Set(
    STREAM_SURFACES.map(
      (surface) => `${plugin.manifest.id}-view-stream-${surface.id}`,
    ),
  );
  const views = new Set<{ disposeView(): void }>();
  const windows = new Map<Document, { close(): void; release(): void }>();
  let closed = false;
  const record = (
    kind: Parameters<typeof event>[0],
    surface: StreamSurface,
  ) => {
    if (!closed) void event(kind, surface).catch(failure);
  };
  for (const definition of STREAM_SURFACES) {
    const type = `${plugin.manifest.id}-view-stream-${definition.id}`;
    class StreamView extends ItemView {
      private release = () => {};
      private projectId = "";
      getViewType() {
        return type;
      }
      getDisplayText() {
        return definition.title;
      }
      getIcon() {
        return definition.icon;
      }
      getState() {
        return { projectId: this.projectId };
      }
      async setState(input: unknown): Promise<void> {
        const id =
          input && typeof input === "object"
            ? Reflect.get(input, "projectId")
            : "";
        this.projectId =
          typeof id === "string" && /^CFP-\d{3,7}$/.test(id) ? id : "";
        await this.onOpen();
      }
      async onOpen(): Promise<void> {
        this.disposeView();
        views.add(this);
        this.contentEl.empty();
        this.contentEl.classList.add("cf-stream-view-content");
        const projection = sourceForProject(this.projectId);
        const root = this.contentEl.createDiv();
        const app = createApp(StreamSurfaceView, {
          surface: definition.id,
          source: projection.source,
        });
        app.mount(root);
        this.release = () => {
          app.unmount();
          root.remove();
          projection.dispose();
        };
        const document = this.containerEl.ownerDocument;
        if (document !== mainDocument && !windows.has(document)) {
          const win = document.defaultView;
          const release = protectStreamWindow(
            document,
            definition.title,
            allowed,
            () => record("stream-view-blocked", definition.id),
          );
          windows.set(document, {
            release,
            close: () => {
              if (win && !win.closed) win.close();
            },
          });
        }
      }
      disposeView(): void {
        this.release();
        this.release = () => {};
        this.contentEl.replaceChildren();
        views.delete(this);
      }
      async onClose(): Promise<void> {
        this.disposeView();
        record("stream-view-closed", definition.id);
      }
    }
    plugin.registerView(type, (leaf) => new StreamView(leaf));
  }
  const actions: StreamViewActions = {
    async open(surface) {
      if (closed) throw new Error("Stream views are closed. Reopen CoForge.");
      const definition = STREAM_SURFACES.find((item) => item.id === surface);
      if (!definition) throw new Error("Choose a public stream view.");
      if (typeof plugin.app.workspace.openPopoutLeaf !== "function")
        throw new Error("Detached stream views require desktop Obsidian.");
      const type = `${plugin.manifest.id}-view-stream-${surface}`;
      const existing = plugin.app.workspace
        .getLeavesOfType(type)
        .find((leaf) => leaf.view.containerEl.ownerDocument !== mainDocument);
      const leaf: WorkspaceLeaf =
        existing ??
        plugin.app.workspace.openPopoutLeaf({
          size: { width: surface === "kanban" ? 1200 : 720, height: 800 },
        });
      if (!existing)
        await leaf.setViewState({
          type,
          active: true,
          state: { projectId: currentProject() },
        });
      await plugin.app.workspace.revealLeaf(leaf);
      record("stream-view-opened", surface);
    },
    async showProject(projectId) {
      if (!/^CFP-\d{3,7}$/.test(projectId))
        throw new Error("Choose an available project first.");
      await actions.open("kanban");
      const type = `${plugin.manifest.id}-view-stream-kanban`;
      const leaf = plugin.app.workspace
        .getLeavesOfType(type)
        .find((leaf) => leaf.view.containerEl.ownerDocument !== mainDocument);
      if (leaf)
        await leaf.setViewState({ type, active: true, state: { projectId } });
    },
  };
  for (const definition of STREAM_SURFACES) {
    const open = () => {
      void actions.open(definition.id).catch(failure);
    };
    plugin.addRibbonIcon(definition.icon, `Open ${definition.title}`, open);
    plugin.addCommand({
      id: `open-stream-${definition.id}`,
      name: `Open ${definition.title}`,
      callback: open,
    });
  }
  plugin.registerEvent(
    plugin.app.workspace.on("window-close", (_window, win) => {
      windows.delete(win.document);
    }),
  );
  const dispose = () => {
    if (closed) return;
    closed = true;
    // Close only capture popouts before removing their privacy curtain. Main-workspace leaves retain host placeholders.
    for (const entry of windows.values()) {
      try {
        entry.close();
      } catch {
        failure();
      }
    }
    windows.clear();
    for (const view of views) view.disposeView();
    views.clear();
  };
  plugin.register(dispose);
  return { actions, dispose };
}
