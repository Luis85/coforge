import { createApp, h } from 'vue';
import ReadableContent from '../../../src/plugin/presentation/components/coforge/ReadableContent.vue';
import { READING_TASK, READING_ANSWER } from './readable-content-fixture';

const root = document.querySelector('.cf-studio');
if (!root) throw new Error('Missing contained reading surface');
const target = document.createElement('section');
target.className = 'cf-readable-proof'; target.setAttribute('data-readable-proof', '');
target.setAttribute('aria-label', 'Captured content reading fixture');
Object.assign(target.style, { position: 'fixed', inset: '0', overflow: 'auto', padding: '24px', background: 'var(--cf-bg)', color: 'var(--cf-text)', zIndex: '200' });
root.append(target);
createApp({ render: () => h('div', {}, [
  h('h2', 'Captured content · synthetic reading fixture'),
  h('section', { 'aria-label': 'Captured task' }, [h('h3', 'Task context'), h(ReadableContent, { source: READING_TASK, originalLabel: 'Original task JSON' })]),
  h('section', { 'aria-label': 'Captured answer' }, [h('h3', 'Agent answer'), h(ReadableContent, { source: READING_ANSWER, originalLabel: 'Original answer text' })]),
]) }).mount(target);
