// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import ReadableContent from '../../../presentation/components/coforge/ReadableContent.vue';

it('presents the captured task as labelled context without changing the exact original', () => {
  const source = JSON.stringify({ trustedProject: { name: 'CoForge', brief: 'A community studio.' }, untrustedCommunityProposal: { title: 'Recruiting CoWorkers', description: 'Offer a **Hiring Pool**.\n\n- Curated agents\n- Explicit hire', contexts: [] }, streamerReviewFeedback: 'Improve the request.', currentModeration: { reason: 'A normal request.', checkedAt: '2026-11-01T19:36:34.329Z' } });
  const wrapper = mount(ReadableContent, { props: { source } });
  const body = wrapper.get('.cf-readable-body');
  expect(body.text()).toContain('Project context');
  expect(body.text()).toContain('Community proposal (untrusted)');
  expect(body.text()).toContain('Host review feedback');
  expect(body.get('strong').text()).toBe('Hiring Pool');
  expect(body.findAll('li').map(item => item.text())).toEqual(['Curated agents', 'Explicit hire']);
  expect(body.text()).not.toContain('"trustedProject":');
  expect(wrapper.get('details').attributes('open')).toBeUndefined();
  expect(wrapper.get('details pre').element.textContent).toBe(source);
  wrapper.unmount();
});

it('reads fenced JSON answers, nested encoded content and Markdown without executing model HTML', () => {
  const source = '```json\n' + JSON.stringify({ summary: '**Ready for review**', result: JSON.stringify({ acceptanceCriteria: ['Human approval', 'No automatic launch'], approved: false, missing: null }), diff: '+<script>execute()</script>', note: '<img src="https://example.com/tracker" onerror="execute()"> [unsafe](obsidian://open) [safe](https://example.com)' }) + '\n```';
  const wrapper = mount(ReadableContent, { props: { source } });
  const body = wrapper.get('.cf-readable-body');
  expect(body.get('strong').text()).toBe('Ready for review');
  expect(body.text()).toContain('Acceptance criteria');
  expect(body.text()).toContain('No');
  expect(body.text()).toContain('Not provided');
  expect(body.get('pre').element.textContent).toBe('+<script>execute()</script>');
  expect(wrapper.find('script, img, iframe').exists()).toBe(false);
  expect(body.findAll('a').map(link => link.attributes('href'))).toEqual(['https://example.com']);
  wrapper.unmount();
});

it('keeps malformed and incomplete captures readable and their original bytes inspectable', () => {
  const source = '{"summary":"Partial answer", "steps":["First"';
  const wrapper = mount(ReadableContent, { props: { source, truncated: true } });
  expect(wrapper.get('.cf-readable-body').text()).toContain('Partial answer');
  expect(wrapper.text()).toContain('incomplete');
  expect(wrapper.get('details pre').element.textContent).toBe(source);
  wrapper.unmount();
});

it('preserves prose separators when a corrected response is appended to captured JSON', () => {
  const source = '{"summary":"First answer"}\n\n--- Additional submitted response ---\n\n{"summary":"Corrected answer"}';
  const wrapper = mount(ReadableContent, { props: { source } });
  expect(wrapper.get('.cf-readable-body').text()).toContain('--- Additional submitted response ---');
  expect(wrapper.get('.cf-readable-body').text()).toContain('Corrected answer');
  expect(wrapper.get('details pre').element.textContent).toBe(source);
  wrapper.unmount();
});

it('distinguishes empty text from missing values without filling in an answer', () => {
  const wrapper = mount(ReadableContent, { props: { source: '{"summary":"","missing":null,"items":[]}' } });
  expect(wrapper.get('.cf-readable-body').text()).toContain('Empty text');
  expect(wrapper.get('.cf-readable-body').text()).toContain('Not provided');
  expect(wrapper.get('.cf-readable-body').text()).toContain('None');
  wrapper.unmount();
});

it('renders Markdown links and task lists without confusing their brackets with JSON arrays', () => {
  for (const source of ['[Read the answer](https://example.com)\n\n- [x] Reviewed\n- [ ] Approval pending', '[1](https://example.com)\n\nA cited answer.']) {
    const wrapper = mount(ReadableContent, { props: { source } });
    expect(wrapper.get('.cf-readable-body a').attributes('href')).toBe('https://example.com');
    expect(wrapper.find('.cf-readable-notice').exists()).toBe(false);
    wrapper.unmount();
  }
});

it('announces bounded reading previews while retaining the complete original and precise numbers', () => {
  const source = JSON.stringify({ rows: Array.from({ length: 1200 }, (_, index) => ({ label: `Result ${index}`, text: 'x'.repeat(100) })) });
  const wrapper = mount(ReadableContent, { props: { source } });
  expect(wrapper.text()).toContain('Reading preview shortened');
  expect(wrapper.findAll('.cf-readable-body *').length).toBeLessThan(3500);
  expect(wrapper.get('details pre').element.textContent).toBe(source);
  wrapper.unmount();
  const precision = mount(ReadableContent, { props: { source: '{"count":9007199254740993}' } });
  expect(precision.get('.cf-readable-body').text()).toContain('9007199254740993');
  precision.unmount();
});

it('treats prototype-shaped keys as captured data and updates the reading view when evidence changes', async () => {
  const source = '{"__proto__":{"summary":"Captured data"},"constructor":"No execution"}';
  const wrapper = mount(ReadableContent, { props: { source } });
  expect(wrapper.get('.cf-readable-body').text()).toContain('Captured data');
  expect(wrapper.get('.cf-readable-body').text()).toContain('No execution');
  await wrapper.setProps({ source: '# Revised answer\n\nA **readable** paragraph.' });
  expect(wrapper.get('.cf-readable-body h1').text()).toBe('Revised answer');
  expect(wrapper.get('.cf-readable-body strong').text()).toBe('readable');
  expect(wrapper.text()).not.toContain('Captured data');
  wrapper.unmount();
});

it('keeps deeply nested provider content inspectable without building an unbounded reading tree', () => {
  let source = '{"answer":"Retained deeply nested answer"}';
  for (let index = 0; index < 200; index++) source = '{"context":' + source + '}';
  const wrapper = mount(ReadableContent, { props: { source } });
  expect(wrapper.text()).toContain('Reading preview shortened');
  expect(wrapper.findAll('.cf-readable-body *').length).toBeLessThan(150);
  expect(wrapper.get('details pre').element.textContent).toBe(source);
  wrapper.unmount();
});
