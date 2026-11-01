// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import SessionStream from '../../../presentation/components/coforge/SessionStream.vue';
import { sessionEventView } from '../../../presentation/composables/coforge/agent-session-display';

const entry = (sequence: number, text: string) => sessionEventView({ kind: 'message', sequence, observedAt: '2026-11-01T12:00:00Z', text }, []);
it('pauses on user scrolling, retains position while counting new events, then resumes at the end without taking focus', async () => {
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
  const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
  const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  const advanceFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(performance.now())); };
  const wrapper = mount(SessionStream, { props: { entries: [entry(1, 'First observation')], selectionKey: 'parent' }, attachTo: document.body });
  try {
    const viewport = wrapper.get('[aria-label="Recorded session observations"]').element;
    if (!(viewport instanceof HTMLElement)) throw new Error('Missing session viewport');
    let height = 1000; let top = 900;
    Object.defineProperties(viewport, { scrollHeight: { configurable: true, get: () => height }, clientHeight: { configurable: true, value: 100 }, scrollTop: { configurable: true, get: () => top, set: value => { top = Math.max(0, Math.min(height - 100, Number(value))); } } });
    await flushPromises(); viewport.focus();
    await wrapper.get('[aria-label="Recorded session observations"]').trigger('wheel', { deltaY: -40 });
    viewport.scrollTop = 200; await wrapper.get('[aria-label="Recorded session observations"]').trigger('scroll');
    expect(wrapper.text()).toContain('Follow paused');
    height = 1200; await wrapper.setProps({ entries: [entry(1, 'First observation'), entry(2, '<img src=x onerror=execute()>')] }); await flushPromises();
    expect(viewport.scrollTop).toBe(200); expect(wrapper.text()).toContain('1 new update');
    expect(document.activeElement).toBe(viewport); expect(wrapper.find('img').exists()).toBe(false);
    await wrapper.setProps({ entries: [entry(2, '<img src=x onerror=execute()>'), entry(3, 'After bounded history rotation')] }); await flushPromises();
    expect(wrapper.text()).toContain('2 new updates');
    const resume = wrapper.findAll('button').find(button => button.text().startsWith('Resume follow'))!;
    const resumeButton = resume.element;
    if (!(resumeButton instanceof HTMLElement)) throw new Error('Missing follow button');
    resumeButton.focus(); await resume.trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('button').element);
    expect(viewport.scrollTop).toBe(1100); expect(wrapper.text()).toContain('Following new observations');
    // A compositor scroll queued by the old gesture must not undo explicit Resume.
    viewport.scrollTop = 900; await wrapper.get('[aria-label="Recorded session observations"]').trigger('scroll'); await flushPromises();
    expect(viewport.scrollTop).toBe(1100); expect(wrapper.text()).toContain('Following new observations');
    advanceFrame(); advanceFrame();
    expect(frames.size).toBe(0);
    expect(wrapper.text()).not.toContain('new updates');
    await wrapper.findAll('button').find(button => button.text() === 'Pause follow')!.trigger('click');
    await wrapper.get('[aria-label="Recorded session observations"]').trigger('scroll');
    expect(wrapper.text()).toContain('Follow paused');
    await wrapper.setProps({ entries: [entry(40, 'A different selected session')], selectionKey: 'child' }); await flushPromises();
    expect(wrapper.text()).toContain('Following new observations'); expect(wrapper.text()).not.toContain('new updates');
  } finally { wrapper.unmount(); expect(frames.size).toBe(0); requestFrame.mockRestore(); cancelFrame.mockRestore(); }
});
