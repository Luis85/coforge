/** Keep the local outline above the actual scroll pane's save bar, including wrapped footers. */
export function observeWorkflowOutline(list: HTMLElement): () => void {
  const ownerDocument = list.ownerDocument;
  const view = ownerDocument.defaultView;
  const pane = list.closest('.cf-content');
  const footer = list.closest('form')?.querySelector('.cf-workflow-editor-save');
  if (!view || !pane || !footer) return () => {};
  let frame = 0;
  const update = () => {
    frame = 0;
    if (!list.isConnected) return;
    const top = Math.max(0, pane.getBoundingClientRect().top, list.getBoundingClientRect().top);
    const viewportHeight = list.ownerDocument.defaultView?.innerHeight ?? view.innerHeight;
    const bottom = Math.min(viewportHeight, pane.getBoundingClientRect().bottom, footer.getBoundingClientRect().top);
    list.style.setProperty('--cf-workflow-outline-height', `${Math.max(240, Math.floor(bottom - top - 8))}px`);
  };
  const schedule = () => { if (!frame) frame = view.requestAnimationFrame(update); };
  const observer = view.ResizeObserver ? new view.ResizeObserver(schedule) : undefined;
  observer?.observe(pane);
  observer?.observe(footer);
  ownerDocument.addEventListener('scroll', schedule, true);
  view.addEventListener('resize', schedule);
  schedule();
  return () => {
    observer?.disconnect();
    ownerDocument.removeEventListener('scroll', schedule, true);
    view.removeEventListener('resize', schedule);
    if (frame) view.cancelAnimationFrame(frame);
    list.style.removeProperty('--cf-workflow-outline-height');
  };
}
