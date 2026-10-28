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
import { registerStreamIcons } from "./stream-icons";
import {
  StreamWindowSlots,
  streamWindowSlot,
  streamWindowSurface,
} from "./stream-window-titles";

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
  registerStreamIcons(plugin);
  const mainDocument = plugin.app.workspace.containerEl.ownerDocument;
  const allowed = new Set(
    STREAM_SURFACES.map(
      (surface) => `${plugin.manifest.id}-view-stream-${surface.id}`,
    ),
  );
  const views = new Set<{ disposeView(): void; syncWindow(): void }>();
  const slots = new StreamWindowSlots<Document>();
  const windows = new Map<
    Document,
    { surface: StreamSurface; title: string; close(): void; release(): void }
  >();
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
      private stateApplied = false;
      private windowSurface: StreamSurface | undefined;
      private windowSlot: number | undefined;
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
        const allocation = slots.get(this.containerEl.ownerDocument);
        const surface = allocation?.surface ?? this.windowSurface;
        const slot = allocation?.slot ?? this.windowSlot;
        return {
          projectId: this.projectId,
          ...(surface && slot
            ? { windowSurface: surface, windowSlot: slot }
            : {}),
        };
      }
      async setState(input: unknown): Promise<void> {
        const id =
          input && typeof input === "object"
            ? Reflect.get(input, "projectId")
            : "";
        this.projectId =
          typeof id === "string" && /^CFP-\d{3,7}$/.test(id) ? id : "";
        if (input && typeof input === "object") {
          const surface = Reflect.get(input, "windowSurface");
          const slot = Reflect.get(input, "windowSlot");
          if (streamWindowSurface(surface)) this.windowSurface = surface;
          if (streamWindowSlot(slot)) this.windowSlot = slot;
        }
        this.stateApplied = true;
        await this.onOpen();
      }
      async onOpen(): Promise<void> {
        this.disposeView();
        views.add(this);
        this.contentEl.empty();
        this.containerEl.classList.add("ps--coforge");
        this.contentEl.classList.add("cf-stream-view-content");
        this.syncWindow();
        const projection = sourceForProject(this.projectId);
        const root = this.contentEl.createDiv({ cls: "cf-stream-root" });
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
      }
      syncWindow(): void {
        if (closed) return;
        const document = this.containerEl.ownerDocument;
        if (document === mainDocument) return;
        let capture = windows.get(document);
        if (!capture) {
          const win = document.defaultView;
          const entry = {
            surface: definition.id,
            title: "CoForge Stream - Opening",
            release: () => {},
            close: () => {
              if (win && !win.closed) win.close();
            },
          };
          entry.release = protectStreamWindow(
            document,
            () => entry.title,
            allowed,
            () => record("stream-view-blocked", entry.surface),
          );
          windows.set(document, entry);
          capture = entry;
        }
        // onOpen can precede restored setState. A nonmatching provisional title prevents a capture collision.
        if (this.stateApplied) {
          const allocation = slots.acquire(
            document,
            this.windowSurface ?? definition.id,
            this.windowSlot,
          );
          this.windowSurface = allocation.surface;
          this.windowSlot = allocation.slot;
          capture.surface = allocation.surface;
          capture.title = allocation.title;
        }
        if (document.title !== capture.title) document.title = capture.title;
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
  async function openTab(
    surface: StreamSurface,
    reuse: boolean,
  ): Promise<WorkspaceLeaf> {
    if (closed) throw new Error("Stream views are closed. Reopen CoForge.");
    const definition = STREAM_SURFACES.find((item) => item.id === surface);
    if (!definition) throw new Error("Choose a public stream view.");
    const type = `${plugin.manifest.id}-view-stream-${surface}`;
    const existing = reuse
      ? plugin.app.workspace
          .getLeavesOfType(type)
          .find((leaf) => leaf.view.containerEl.ownerDocument === mainDocument)
      : undefined;
    let leaf = existing;
    if (!leaf) {
      const main = plugin.app.workspace.getMostRecentLeaf(
        plugin.app.workspace.rootSplit,
      );
      if (main) plugin.app.workspace.setActiveLeaf(main, { focus: false });
      leaf = main
        ? plugin.app.workspace.getLeaf("tab")
        : plugin.app.workspace.createLeafInParent(
            plugin.app.workspace.rootSplit,
            0,
          );
      if (leaf.view.containerEl.ownerDocument !== mainDocument) {
        leaf.detach();
        throw new Error(
          "The public tab could not be created in the main workspace. Open a main tab and try again.",
        );
      }
    }
    if (!existing)
      await leaf.setViewState({
        type,
        active: true,
        state: { projectId: currentProject() },
      });
    await plugin.app.workspace.revealLeaf(leaf);
    record("stream-view-opened", surface);
    return leaf;
  }
  const actions: StreamViewActions = {
    async open(surface) {
      // Explicit Open, ribbon and command interactions always create a fresh main-workspace tab.
      await openTab(surface, false);
    },
    async showProject(projectId) {
      if (!/^CFP-\d{3,7}$/.test(projectId))
        throw new Error("Choose an available project first.");
      const leaf = await openTab("kanban", true);
      const type = `${plugin.manifest.id}-view-stream-kanban`;
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
    plugin.app.workspace.on("window-close", (container) => {
      windows.delete(container.doc);
      slots.release(container.doc);
    }),
  );
  const syncWindows = () => {
    if (!closed) for (const view of views) view.syncWindow();
  };
  plugin.registerEvent(plugin.app.workspace.on("layout-change", syncWindows));
  plugin.registerEvent(plugin.app.workspace.on("window-open", syncWindows));
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
    slots.clear();
    for (const view of views) view.disposeView();
    views.clear();
  };
  plugin.register(dispose);
  return { actions, dispose };
}
