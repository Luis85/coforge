<script setup lang="ts">
import { useExampleCleanup } from '../../composables/coforge/use-example-cleanup';
const model = useExampleCleanup();
</script>
<template>
  <section class="cf-example-cleanup" aria-label="Remove example and local-test content">
    <h2>Finish experimenting</h2>
    <p class="cf-settings-help">Preview loaded samples and local simulator content before removing them. Requests you authored manually and Twitch requests are preserved, including requests processed by simulated agents.</p>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.disabled" @click="model.inspect()">{{ model.working ? 'Working…' : model.preview ? 'Refresh cleanup preview' : 'Preview example cleanup' }}</button>
    <p v-if="model.error" role="alert" class="cf-inline-error">{{ model.error }}</p>
    <p v-if="model.notice" role="status" class="cf-settings-help">{{ model.notice }}</p>
    <div v-if="model.preview" class="cf-example-cleanup-preview">
      <h3>Review exactly what will be removed</h3>
      <p>{{ model.selectedCount }} requests selected · {{ model.preview.localChatCount }} local simulator messages · {{ model.preview.localProfileCount }} unreferenced local profiles · temporary examples will close.</p>
      <p>{{ model.preview.economyUsageCount }} local-test Economy receipts · {{ model.preview.economyPerkCount }} related local-test manual perks will be removed. Viewer Economy activity and its fulfillment history stay.</p>
      <p class="cf-settings-help">Selected request notes go to Obsidian’s trash with their related run and activity history. Unreferenced local profiles are removed. Project containers, live Twitch chat, retained requests, their votes and real cost evidence stay. Historical counters and external recovery evidence are kept where attribution is uncertain.</p>
      <details v-if="model.preview.automatic.length">
        <summary>Tracked samples and local-test requests · {{ model.preview.automatic.length }}</summary>
        <ul class="cf-example-cleanup-list"><li v-for="item in model.automatic" :key="item.id"><code>{{ item.id }}</code> {{ item.title }} <small>{{ item.projectId }}</small></li></ul>
        <button v-if="model.moreAutomatic" type="button" class="cf-btn cf-btn-ghost" @click="model.showMore()">Show 50 more tracked requests</button>
      </details>
      <details v-if="model.preview.legacy.length || model.preview.ambiguous.length">
        <summary>Historical requests kept unless you select them · {{ model.preview.legacy.length + model.preview.ambiguous.length }}</summary>
        <p class="cf-settings-help">Older versions did not record reliable request origin. A matching original sample is a suggestion. Select an exact request only if you want its note and history removed; modified or manually authored requests may be in this list.</p>
        <ul class="cf-example-cleanup-list"><li v-for="item in model.historical" :key="item.id"><label><input v-model="model.selected" type="checkbox" :value="item.id" :disabled="model.working"><span><code>{{ item.id }}</code> {{ item.title }}<small>{{ item.label }} · {{ item.projectId }}</small></span></label></li></ul>
        <button v-if="model.more" type="button" class="cf-btn cf-btn-ghost" @click="model.showMore()">Show 50 more historical requests</button>
      </details>
      <p v-if="model.preview.blocked && model.persistentlyChanging" role="status" class="cf-inline-error">{{ model.preview.blocked }}</p>
      <label class="cf-example-cleanup-consent"><input v-model="model.confirmed" type="checkbox" :disabled="model.working"><span>I reviewed the selected requests and local content above and want to remove them.</span></label>
      <div class="cf-settings-actions">
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.working" @click="model.cancel()">Keep content</button>
        <button type="button" class="cf-btn cf-btn-danger" :disabled="!model.canRemove" @click="model.remove()">{{ model.working ? 'Removing…' : model.persistentlyChanging ? 'Remove selected examples and local content' : 'Close temporary examples' }}</button>
      </div>
    </div>
  </section>
</template>
