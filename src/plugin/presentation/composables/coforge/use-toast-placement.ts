import { onBeforeUnmount, onMounted, ref } from 'vue';

const FOOTERS = '.cf-idea-footer, .cf-settings-save, .cf-idea-form-footer, .cf-active-job-dock';
const HEADERS = '.cf-topbar, .cf-idea-top, .cf-idea-heading, .cf-idea-tabs, .cf-new-idea-header, .cf-new-idea-heading';
function element(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && 'nodeType' in value && value.nodeType === 1 &&
    'getBoundingClientRect' in value && typeof value.getBoundingClientRect === 'function' &&
    'closest' in value && typeof value.closest === 'function' && 'contains' in value && typeof value.contains === 'function' &&
    'ownerDocument' in value && typeof value.ownerDocument === 'object' && value.ownerDocument !== null;
}

/** Keep transient feedback in the available reading area, clear of measured operator controls. */
export function useToastPlacement() {
  const style = ref<{ bottom?: string; maxHeight?: string }>({});
  let stack: Element | undefined; let root: HTMLElement | null = null; let mounted = false;
  let owner: Document['defaultView'] = null;
  let resize: ResizeObserver | undefined; let mutations: MutationObserver | undefined; let frame: number | undefined;
  function measure() {
    if (!stack || !root || !owner) return;
    const viewport = root.getBoundingClientRect(); const toast = stack.getBoundingClientRect();
    const gap = Number.parseFloat(owner.getComputedStyle(stack).gap) || 8;
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect(); const appearance = owner?.getComputedStyle(element);
      return box.width > 0 && box.height > 0 && box.bottom > viewport.top && box.top < Math.min(viewport.bottom, owner?.innerHeight ?? viewport.bottom) &&
        box.left < toast.right && box.right > toast.left && appearance?.display !== 'none' && appearance?.visibility !== 'hidden';
    };
    const footers = [...root.querySelectorAll(FOOTERS)].filter(visible);
    const bottom = Math.max(40, viewport.bottom - owner.innerHeight + gap,
      ...footers.map(footer => viewport.bottom - footer.getBoundingClientRect().top + gap));
    const headerBottom = Math.max(viewport.top, ...[...root.querySelectorAll(HEADERS)].filter(visible).map(header => header.getBoundingClientRect().bottom));
    const maxHeight = Math.max(0, Math.min(viewport.height / 2, viewport.bottom - bottom - headerBottom - gap));
    const next = { bottom: `${bottom}px`, maxHeight: `${maxHeight}px` };
    if (style.value.bottom !== next.bottom || style.value.maxHeight !== next.maxHeight) style.value = next;
  }
  function schedule() {
    if (root && root.ownerDocument.defaultView !== owner) { connect(); return; }
    if (!owner) return;
    if (frame !== undefined) return;
    frame = owner.requestAnimationFrame(() => { frame = undefined; measure(); });
  }
  function observeRegions() {
    resize?.disconnect();
    if (!root || !stack) return;
    for (const element of [root, stack, ...root.querySelectorAll(`${FOOTERS}, ${HEADERS}`)]) resize?.observe(element);
  }
  function disconnect() {
    resize?.disconnect(); mutations?.disconnect();
    owner?.removeEventListener('resize', schedule); root?.removeEventListener('scroll', schedule, true);
    if (frame !== undefined) owner?.cancelAnimationFrame(frame);
    frame = undefined; resize = undefined; mutations = undefined;
  }
  function connect() {
    disconnect(); root = stack?.closest<HTMLElement>('.cf-studio') ?? null;
    owner = root?.ownerDocument.defaultView ?? null;
    if (!root || !stack || !owner) return;
    const Resize = owner.ResizeObserver; if (Resize) resize = new Resize(schedule);
    observeRegions();
    mutations = new owner.MutationObserver(records => {
      if (records.every(record => record.target === stack || stack?.contains(record.target))) return;
      if (root?.ownerDocument.defaultView !== owner) { schedule(); return; }
      observeRegions(); schedule();
    });
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    owner.addEventListener('resize', schedule); root.addEventListener('scroll', schedule, { capture: true, passive: true });
    measure();
  }
  onMounted(() => { mounted = true; connect(); });
  onBeforeUnmount(disconnect);
  return { style, bind: (value: unknown) => { stack = element(value) ? value : undefined; if (mounted) connect(); } };
}
