// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { observeWorkflowOutline } from '../../../presentation/composables/coforge/workflow-outline-layout';

it('recomputes outline clearance when its footer wraps and releases observers/listeners on disposal', () => {
  const heightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
  const pane = document.createElement('section'); pane.className = 'cf-content';
  const form = document.createElement('form');
  const outline = document.createElement('section');
  const footer = document.createElement('footer'); footer.className = 'cf-workflow-editor-save';
  pane.append(form); form.append(outline, footer); document.body.append(pane);
  pane.getBoundingClientRect = () => new DOMRect(0, 100, 600, 800);
  outline.getBoundingClientRect = () => new DOMRect(0, 120, 220, 500);
  let footerTop = 820;
  footer.getBoundingClientRect = () => new DOMRect(0, footerTop, 600, 80);
  const callbacks: FrameRequestCallback[] = [];
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callbacks.push(callback); return callbacks.length; });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const stop = observeWorkflowOutline(outline);
  try {
    callbacks.shift()!(0);
    expect(outline.style.getPropertyValue('--cf-workflow-outline-height')).toBe('692px');
    footerTop = 700;
    window.dispatchEvent(new Event('resize'));
    callbacks.shift()!(0);
    expect(outline.style.getPropertyValue('--cf-workflow-outline-height')).toBe('572px');
    pane.getBoundingClientRect = () => new DOMRect(0, -200, 600, 1000);
    outline.getBoundingClientRect = () => new DOMRect(0, -60, 220, 500);
    document.dispatchEvent(new Event('scroll'));
    callbacks.shift()!(0);
    expect(outline.style.getPropertyValue('--cf-workflow-outline-height')).toBe('692px');
    document.dispatchEvent(new Event('scroll'));
    stop();
    expect(cancel).toHaveBeenCalled();
    expect(outline.style.getPropertyValue('--cf-workflow-outline-height')).toBe('');
    request.mockClear();
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('scroll'));
    expect(request).not.toHaveBeenCalled();
  } finally {
    stop(); pane.remove(); vi.restoreAllMocks();
    if (heightDescriptor) Object.defineProperty(window, 'innerHeight', heightDescriptor);
    else Reflect.deleteProperty(window, 'innerHeight');
  }
});
