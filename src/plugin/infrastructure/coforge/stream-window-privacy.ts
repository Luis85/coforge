/** A detached capture window is safe only while every pane is a public stream view and no host dialog is visible. */
export function captureWindowBlocked(
  document: Document,
  allowed: ReadonlySet<string>,
): boolean {
  const panes = [
    ...document.querySelectorAll(".workspace-leaf-content[data-type]"),
  ];
  return (
    !panes.length ||
    panes.some((pane) => !allowed.has(pane.getAttribute("data-type") ?? "")) ||
    [
      ...document.querySelectorAll('.modal-container, .menu, [role="dialog"]'),
    ].some((element) => element.getClientRects().length > 0)
  );
}
export function protectStreamWindow(
  document: Document,
  title: string | (() => string),
  allowed: ReadonlySet<string>,
  blocked: () => void,
): () => void {
  // This independent privacy layer survives removal of the plugin stylesheet while a popout is closing.
  const Sheet = document.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new Sheet();
  sheet.replaceSync(
    ".coforge-stream-window .view-header,.coforge-stream-window .workspace-tab-header-container,.coforge-stream-window .workspace-ribbon,.coforge-stream-window .status-bar,.coforge-stream-window .titlebar-text{display:none!important}.coforge-stream-window.coforge-stream-blocked>:not(.cf-stream-curtain){display:none!important}.cf-stream-curtain{position:fixed;inset:0;display:grid;place-content:center;padding:32px;background:var(--background-primary);color:var(--text-normal);z-index:2147483647;font:18px/1.6 var(--font-interface)}.cf-stream-curtain[hidden]{display:none}",
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const curtain = document.body.createEl("section");
  curtain.className = "cf-stream-curtain";
  curtain.setAttribute("role", "status");
  const heading = curtain.createEl("h1");
  heading.textContent = "Stream display paused";
  const help = curtain.createEl("p");
  help.textContent =
    "This window contains another pane or dialog. Close it to resume the public display.";
  curtain.append(heading, help);
  document.body.append(curtain);
  document.body.classList.add("coforge-stream-window");
  let wasBlocked = false;
  let closed = false;
  const refresh = () => {
    if (closed) return;
    const currentTitle = typeof title === "string" ? title : title();
    if (document.title !== currentTitle) document.title = currentTitle;
    const next = captureWindowBlocked(document, allowed);
    if (next !== wasBlocked) {
      wasBlocked = next;
      document.body.classList.toggle("coforge-stream-blocked", next);
      if (next) blocked();
    }
    if (curtain.hidden === next) curtain.hidden = !next;
  };
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-type", "class", "style", "hidden"],
  });
  refresh();
  const release = () => {
    if (closed) return;
    closed = true;
    observer.disconnect();
    curtain.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (value) => value !== sheet,
    );
    document.body.classList.remove(
      "coforge-stream-window",
      "coforge-stream-blocked",
    );
    document.defaultView?.removeEventListener("unload", release);
  };
  document.defaultView?.addEventListener("unload", release, { once: true });
  return release;
}
