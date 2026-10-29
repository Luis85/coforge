// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { Window } from 'happy-dom';
import AlertsView from '../../../presentation/components/coforge/AlertsView.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { useAlertsStore } from '../../../presentation/stores/coforge-alerts';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { alertsFixture, welcomeAlert } from './alert-test-fixture';

function button(wrapper: VueWrapper, label: string) {
  const result = wrapper.findAll('button').find(item => item.text().trim() === label);
  if (!result) throw new Error(`Missing alert action: ${label}`);
  return result;
}
function field(wrapper: VueWrapper, label: string) {
  const result = wrapper.findAll('label').find(item => item.find('span').exists() && item.get('span').text() === label);
  if (!result) throw new Error(`Missing alert field: ${label}`);
  return result.get('input,textarea,select');
}
async function fixture(sources = 1) {
  const env = await workflowUiFixture(); const f = alertsFixture(sources); await f.service.start();
  const context: CoforgeContext = { studio: env.studio, onNotice: () => () => {}, startupError: () => null, host: {
    alerts: f.service, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => '',
    publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }),
  } };
  const wrapper = mount(AlertsView, { attachTo: document.body, global: { plugins: [env.pinia], provide: { [coforgeKey]: context }, directives: { 'cf-icon': () => {} } } });
  return { ...f, env, wrapper, store: useAlertsStore(env.pinia),
    async dispose() { wrapper.unmount(); document.body.replaceChildren(); await f.service.dispose(); await env.dispose(); },
  };
}

it('ALERTS-06 retains failed drafts, reconciles canonical trimmed values and fires literal text only after a successful save', async () => {
  const f = await fixture(); const { wrapper } = f;
  try {
    await button(wrapper, 'New alert').trigger('click'); await flushPromises();
    expect(document.activeElement).toBe(field(wrapper, 'Alert name').element);
    await field(wrapper, 'Alert name').setValue('  Welcome  ');
    await field(wrapper, 'Text template').setValue('Hello {{viewer}}');
    f.save.mockRejectedValueOnce(new Error('Disk full'));
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Disk full');
    expect(f.store.drafts[f.store.selected]?.name).toBe('  Welcome  ');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(f.store.drafts[f.store.selected]?.name).toBe('Welcome');
    expect(button(wrapper, 'Fire alert to OBS').attributes('disabled')).toBeUndefined();
    expect(document.activeElement).toBe(button(wrapper, 'Fire alert to OBS').element);
    await field(wrapper, 'viewer').setValue('<b>Ada</b>');
    await button(wrapper, 'Fire alert to OBS').trigger('click'); await flushPromises();
    expect(f.send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello <b>Ada</b>' }));
    expect(wrapper.find('.cf-alerts-text-preview b').exists()).toBe(false);
    expect(wrapper.get('[aria-label="Alert action result"]').text()).toContain('Sent to 1 connected browser source');
    await button(wrapper, 'Delete alert…').trigger('click'); expect(wrapper.get('.cf-alerts-delete').text()).toContain('Welcome');
    await button(wrapper, 'Keep alert').trigger('click'); expect(f.service.snapshot().templates).toHaveLength(1);
    await button(wrapper, 'Delete alert…').trigger('click'); await button(wrapper, 'Delete this alert').trigger('click'); await flushPromises();
    expect(f.service.snapshot().templates).toEqual([]); expect(document.activeElement).toBe(button(wrapper, 'New alert').element);
  } finally { await f.dispose(); }
});

it('shows truthful zero-source recovery and live connection counts without claiming playback success', async () => {
  const f = await fixture(0); const { wrapper } = f;
  try {
    await f.service.save({ ...welcomeAlert, text: 'Ready', event: '', enabled: false }); await flushPromises();
    expect(wrapper.get('[aria-label="Browser source connection"]').text()).toContain('No browser source connected');
    expect(button(wrapper, 'Fire alert to OBS').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('No source can receive this alert yet');
    await button(wrapper, 'Show OBS setup').trigger('click'); await flushPromises();
    expect(wrapper.get('.cf-alerts-source details').attributes('open')).toBeDefined();
    f.sources(2); await flushPromises();
    expect(wrapper.get('[aria-label="Browser source connection"]').text()).toContain('2 browser sources connected');
    expect(button(wrapper, 'Fire alert to OBS').attributes('disabled')).toBeUndefined();
    await button(wrapper, 'Fire alert to OBS').trigger('click'); await flushPromises();
    expect(wrapper.get('[aria-label="Alert action result"]').text()).toContain('Sent to 2 connected browser sources');
    expect(wrapper.get('[aria-label="Alert action result"]').text()).toContain('Check OBS');
  } finally { await f.dispose(); }
});

it('keeps each template draft while switching selection and prevents impossible automatic variables before saving', async () => {
  const f = await fixture(); const { wrapper } = f;
  try {
    await f.service.save({ ...welcomeAlert, id: 'one', name: 'One', text: 'One', enabled: false });
    await f.service.save({ ...welcomeAlert, id: 'two', name: 'Two', text: 'Two', enabled: false }); await flushPromises();
    await field(wrapper, 'Text template').setValue('Authored draft for One');
    const select = async (name: string) => {
      const choice = wrapper.findAll('.cf-alerts-list button').find(item => item.get('strong').text() === name);
      if (!choice) throw new Error(`Missing template: ${name}`); await choice.trigger('click');
    };
    await select('Two'); await field(wrapper, 'Text template').setValue('Authored draft for Two'); await select('One');
    expect(field(wrapper, 'Text template').element).toHaveProperty('value', 'Authored draft for One');
    expect(f.service.snapshot().templates.find(item => item.id === 'one')?.text).toBe('One');
    await field(wrapper, 'Text template').setValue('Hello {{viewer}}');
    await field(wrapper, 'CoForge event').setValue('stream-started');
    await wrapper.get('input[type="checkbox"]').setValue(true); await flushPromises();
    expect(wrapper.text()).toContain('cannot supply: viewer');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(f.service.snapshot().templates.find(item => item.id === 'one')?.text).toBe('One');
    expect(wrapper.get('[role="alert"]').text()).toContain('viewer');
  } finally { await f.dispose(); }
});

it('keeps Stop available during a pending dispatch and does not overwrite its result with an older action', async () => {
  const f = await fixture(); const { wrapper } = f;
  try {
    await f.service.save({ ...welcomeAlert, text: 'Ready', event: '', enabled: false }); await flushPromises();
    let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
    f.checkMedia.mockImplementationOnce(async () => { await gate; });
    await button(wrapper, 'Fire alert to OBS').trigger('click');
    expect(f.store.busy).toBe(true); expect(button(wrapper, 'Stop all alerts').attributes('disabled')).toBeUndefined();
    await button(wrapper, 'Stop all alerts').trigger('click'); release(); await flushPromises();
    expect(wrapper.get('[aria-label="Alert action result"]').text()).toContain('Playback and queued alerts cleared');
    expect(f.send).not.toHaveBeenCalled(); expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  } finally { await f.dispose(); }
});

it('accepts native input, number, select, checkbox and variable events from a different window document', async () => {
  const f = await fixture(); const { wrapper } = f; const foreign = new Window();
  foreign.document.body.innerHTML = '<input id="text"><input id="number" type="number"><input id="check" type="checkbox"><textarea></textarea><select><option value="registered">Registered</option></select>';
  const text = foreign.document.querySelector('#text'); const numeric = foreign.document.querySelector('#number');
  const check = foreign.document.querySelector('#check'); const textarea = foreign.document.querySelector('textarea'); const select = foreign.document.querySelector('select');
  if (!(text instanceof foreign.HTMLInputElement) || !(numeric instanceof foreign.HTMLInputElement) || !(check instanceof foreign.HTMLInputElement) || !textarea || !select) throw new Error('Foreign-window fixture missing');
  const transfer = (destination: Element, kind: string, target: object) => {
    const event = new Event(kind, { bubbles: true }); Object.defineProperty(event, 'target', { value: target }); destination.dispatchEvent(event);
  };
  try {
    expect(text.ownerDocument).not.toBe(document);
    await button(wrapper, 'New alert').trigger('click'); await flushPromises();
    text.value = 'Foreign window alert'; transfer(field(wrapper, 'Alert name').element, 'input', text);
    textarea.value = 'Hello {{viewer}}'; transfer(field(wrapper, 'Text template').element, 'input', textarea);
    numeric.value = '9'; transfer(field(wrapper, 'Duration (seconds)').element, 'input', numeric);
    transfer(field(wrapper, 'CoForge event').element, 'change', select);
    check.checked = true; transfer(wrapper.get('input[type="checkbox"]').element, 'change', check); await flushPromises();
    expect(f.store.drafts[f.store.selected]).toMatchObject({ name: 'Foreign window alert', text: 'Hello {{viewer}}', duration: 9, event: 'registered', enabled: true });
    await wrapper.get('form').trigger('submit'); await flushPromises();
    text.value = 'Ada from another window'; transfer(field(wrapper, 'viewer').element, 'input', text); await flushPromises();
    await button(wrapper, 'Fire alert to OBS').trigger('click'); await flushPromises();
    expect(f.send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello Ada from another window' }));
  } finally { foreign.close(); await f.dispose(); }
});
