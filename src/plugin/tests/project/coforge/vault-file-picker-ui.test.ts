// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import VaultFilePicker from '../../../presentation/components/coforge/VaultFilePicker.vue';

it('searches vault files and appends a deduplicated wikilink list without replacing input', async () => {
  const listFiles = vi.fn(async () => ['Plans/Overview.md', 'Research/Overview.md', 'Assets/chart.png', 'Invalid[link].md', 'Invalid#heading.md']);
  const wrapper = mount(VaultFilePicker, { props: { modelValue: 'Keep this question.\n- [[Plans/Overview|Overview]]', listFiles } });
  try {
    expect(listFiles).not.toHaveBeenCalled();
    wrapper.get('details').element.setAttribute('open', ''); await flushPromises();
    expect(listFiles).toHaveBeenCalled();
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3);
    await wrapper.get('input[type="search"]').setValue('Overview');
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2);
    for (const checkbox of wrapper.findAll('input[type="checkbox"]')) await checkbox.setValue(true);
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Keep this question.\n- [[Plans/Overview|Overview]]\n\n- [[Research/Overview]]']]);
  } finally { wrapper.unmount(); }
});

it('preserves input and selection on a limit error and can retry a failed listing', async () => {
  const listFiles = vi.fn<() => Promise<string[]>>().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(['Context.md']);
  const wrapper = mount(VaultFilePicker, { props: { modelValue: 'x'.repeat(60000), listFiles } });
  try {
    wrapper.get('details').element.setAttribute('open', '');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be listed');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.get('details').element.removeAttribute('open'); await flushPromises();
    wrapper.get('details').element.setAttribute('open', ''); await flushPromises();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain('exceed the input limit');
    expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', true);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  } finally { wrapper.unmount(); }
});
