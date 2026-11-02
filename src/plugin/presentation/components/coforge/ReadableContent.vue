<script setup lang="ts">
import { useReadableContent } from '../../composables/coforge/use-readable-content';
const props = withDefaults(defineProps<{ source: string; truncated?: boolean; originalLabel?: string }>(), { originalLabel: 'Original text' });
const model = useReadableContent(props);
</script>
<template>
  <div class="cf-readable-content">
    <p v-if="model.document.value.incomplete" class="cf-readable-notice">Structured content is incomplete or could not be decoded. The retained text is shown without filling in missing content.</p>
    <p v-if="model.document.value.precision" class="cf-readable-notice">Original number notation is preserved to avoid rounding.</p>
    <div class="cf-readable-body"><component :is="model.content" /></div>
    <p v-if="model.document.value.limited" class="cf-readable-notice">Reading preview shortened. Open the original text to inspect the full retained capture.</p>
    <details class="cf-readable-original">
      <summary>{{ originalLabel }}</summary>
      <pre class="cf-readable-source" tabindex="0" :aria-label="originalLabel">{{ source }}</pre>
    </details>
  </div>
</template>
