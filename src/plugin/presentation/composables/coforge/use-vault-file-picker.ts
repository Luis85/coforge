import { computed, onBeforeUnmount, reactive, ref } from 'vue';

const target = (path: string) => path.replace(/\.md$/i, '');
/** Explicit link authoring never reads note content or admits Council work. */
export function useVaultFilePicker(props: { modelValue: string; listFiles?: () => Promise<string[]> }, update: (value: string) => void) {
  const query = ref('');
  const files = ref<string[]>([]);
  const selected = ref<string[]>([]);
  const busy = ref(false);
  const error = ref('');
  let generation = 0;
  onBeforeUnmount(() => { generation++; });
  const matching = computed(() => files.value.filter(path => path.toLowerCase().includes(query.value.toLowerCase())));
  async function load(event: Event) {
    if (!(event.target instanceof HTMLDetailsElement) || !event.target.open || !props.listFiles) return;
    const current = ++generation;
    busy.value = true; error.value = '';
    try {
      const value = await props.listFiles();
      if (current !== generation) return;
      files.value = [...new Set(value)].filter(path => path && !/[[\]|#^\r\n]/u.test(path)).sort((a, b) => a.localeCompare(b));
      selected.value = selected.value.filter(path => files.value.includes(path));
    } catch {
      if (current === generation) error.value = 'Vault files could not be listed. Reopen the picker to retry; your input is kept.';
    } finally { if (current === generation) busy.value = false; }
  }
  function append() {
    const existing = new Set([...props.modelValue.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/gu)].map(match => target(match[1] ?? '')));
    const links = selected.value.filter(path => files.value.includes(path) && !existing.has(target(path))).map(path => `- [[${target(path)}]]`);
    const next = props.modelValue + (props.modelValue && links.length ? '\n\n' : '') + links.join('\n');
    if (next.length > 60000) { error.value = 'These links exceed the input limit. Choose fewer files; your input is kept.'; return; }
    if (links.length) update(next);
    selected.value = []; error.value = '';
  }
  return reactive({ query, selected, busy, error, available: computed(() => Boolean(props.listFiles)), matching: computed(() => matching.value.length), files: computed(() => matching.value.slice(0, 100)), load, append,
    select: (path: string) => { selected.value = selected.value.includes(path) ? selected.value.filter(value => value !== path) : [...selected.value, path]; },
  });
}
