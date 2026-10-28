const INSET = "--cf-host-status-inset";
const STATUS_BAR = ".status-bar";

/** Only a visible native bar touching this view's bottom edge can obscure its composer. */
export function hostStatusInset(root: Element): number {
  const bounds = root.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return 0;
  const win = root.ownerDocument.defaultView;
  let inset = 0;
  for (const bar of root.ownerDocument.querySelectorAll(STATUS_BAR)) {
    const style = win?.getComputedStyle(bar);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.visibility === "collapse"
    )
      continue;
    const rect = bar.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.right <= bounds.left ||
      rect.left >= bounds.right ||
      rect.bottom < bounds.bottom
    )
      continue;
    inset = Math.max(
      inset,
      Math.min(bounds.bottom, rect.bottom) - Math.max(bounds.top, rect.top),
    );
  }
  return Math.ceil(Math.max(0, inset));
}

function element(node: Node): node is Element {
  return (
    node.nodeType === 1 &&
    "matches" in node &&
    typeof node.matches === "function"
  );
}

/** View-scoped host geometry. Rebinds after document adoption and never reserves a global footer height. */
export function observeHostStatusInset(root: HTMLElement): () => void {
  let closed = false;
  let revision = 0;
  let releaseOwner = () => {};
  const measure = () => {
    if (closed) return;
    const next = `${hostStatusInset(root)}px`;
    if (root.style.getPropertyValue(INSET) !== next)
      root.style.setProperty(INSET, next);
  };
  function bindOwner(): void {
    const epoch = ++revision;
    releaseOwner();
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const bars = new Set<Element>();
    let frame: number | undefined;
    const schedule = () => {
      if (closed || epoch !== revision) return;
      if (root.ownerDocument !== doc) {
        bindOwner();
        return;
      }
      if (
        !win ||
        win.closed ||
        typeof win.requestAnimationFrame !== "function"
      ) {
        measure();
        return;
      }
      if (frame !== undefined) return;
      frame = win.requestAnimationFrame(() => {
        frame = undefined;
        if (closed || epoch !== revision) return;
        if (root.ownerDocument !== doc) bindOwner();
        else measure();
      });
    };
    const Resize = win?.ResizeObserver;
    const resize = Resize ? new Resize(schedule) : undefined;
    resize?.observe(root);
    const syncBars = () => {
      const next = new Set(doc.querySelectorAll(STATUS_BAR));
      for (const bar of bars)
        if (!next.has(bar)) {
          resize?.unobserve(bar);
          bars.delete(bar);
        }
      for (const bar of next)
        if (!bars.has(bar)) {
          bars.add(bar);
          resize?.observe(bar);
        }
    };
    const relevantNode = (node: Node) =>
      element(node) &&
      (node === root ||
        node.contains(root) ||
        node.matches(STATUS_BAR) ||
        Boolean(node.querySelector(STATUS_BAR)));
    const Mutation = win?.MutationObserver;
    const mutation = Mutation
      ? new Mutation((records) => {
          if (closed || epoch !== revision) return;
          if (root.ownerDocument !== doc) {
            schedule();
            return;
          }
          let changed = false;
          let refreshBars = false;
          for (const record of records) {
            if (record.type === "childList") {
              if (
                Array.from(record.addedNodes).some(relevantNode) ||
                Array.from(record.removedNodes).some(relevantNode)
              ) {
                refreshBars = true;
                changed = true;
              }
            } else if (element(record.target)) {
              const target = record.target;
              if (bars.has(target) || target.matches(STATUS_BAR)) {
                refreshBars = true;
                changed = true;
              } else if (
                target === root ||
                target.contains(root) ||
                Array.from(bars).some((bar) => target.contains(bar))
              )
                changed = true;
            }
          }
          if (refreshBars) syncBars();
          if (changed) schedule();
        })
      : undefined;
    mutation?.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
    win?.addEventListener("resize", schedule);
    doc.addEventListener("scroll", schedule, true);
    doc.addEventListener("visibilitychange", schedule);
    releaseOwner = () => {
      mutation?.disconnect();
      resize?.disconnect();
      if (frame !== undefined) win?.cancelAnimationFrame(frame);
      win?.removeEventListener("resize", schedule);
      doc.removeEventListener("scroll", schedule, true);
      doc.removeEventListener("visibilitychange", schedule);
    };
    syncBars();
    measure();
  }
  bindOwner();
  return () => {
    if (closed) return;
    closed = true;
    releaseOwner();
    root.style.removeProperty(INSET);
  };
}
