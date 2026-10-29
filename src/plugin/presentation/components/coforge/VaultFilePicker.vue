<script setup lang="ts">
import { useVaultFilePicker } from '../../composables/coforge/use-vault-file-picker';
const props = defineProps<{ modelValue: string; listFiles?: () => Promise<string[]> }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const picker = useVaultFilePicker(props, value => emit('update:modelValue', value));
</script>
<template>
  <details class="cf-vault-file-picker" @toggle="picker.load($event)">
    <summary>Add vault files</summary>
    <p v-if="!picker.available" role="status">The vault file picker is available in desktop Obsidian. You can also enter wikilinks in your input.</p>
    <template v-else>
      <label class="cf-field"><span>Search vault files</span><input v-model="picker.query" type="search" placeholder="File name or folder" /></label>
      <p v-if="picker.busy" role="status">Loading vault files…</p>
      <p v-if="picker.error" class="cf-inline-error" role="alert">{{ picker.error }}</p>
      <ul aria-label="Vault files" class="cf-vault-file-options"><li v-for="path in picker.files" :key="path"><label><input type="checkbox" :checked="picker.selected.includes(path)" @change="picker.select(path)" /><span>{{ path }}</span></label></li></ul>
      <p v-if="!picker.busy && !picker.matching">No matching files. Try another file name or folder.</p>
      <p v-if="picker.matching > picker.files.length">Showing {{ picker.files.length }} of {{ picker.matching }} matches. Refine the search to find another file.</p>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="picker.busy || !picker.selected.length" @click="picker.append()">Add {{ picker.selected.length || '' }} {{ picker.selected.length === 1 ? 'wikilink' : 'wikilinks' }} to input</button>
      <p class="cf-settings-help">Adds a Markdown list of wikilinks. Your existing input stays intact; files with wikilink delimiters in their names are omitted.</p>
    </template>
  </details>
</template>
