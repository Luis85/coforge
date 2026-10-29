<script setup lang="ts">
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
import { useTwitchOperationsReceipts } from '../../composables/coforge/use-twitch-operations-polish';
const model = useTwitchOperationsSection();
const receipt = useTwitchOperationsReceipts();
</script>
<template>
  <section v-if="model.recentIntents.length" class="cf-twitch-operation-history" aria-label="Recent Twitch actions">
    <h2>Recent actions</h2>
    <ol class="cf-twitch-operation-record-list"><li v-for="intent in model.recentIntents" :key="intent.id">
      <h3>{{ model.actionLabel(intent.action.name) }}</h3>
      <p>{{ model.time(intent.createdAt) }} · channel {{ intent.channelId }} · {{ receipt.status(intent) }}</p>
      <p v-if="intent.error">{{ intent.error }}</p>
      <dl v-if="intent.receipt"><template v-for="(value, key) in intent.receipt" :key="key"><dt>{{ model.fieldLabel(key) }}</dt><dd>{{ model.displayValue(value) }}</dd></template></dl>
      <div class="cf-settings-actions"><a v-for="link in receipt.links(intent.receipt)" :key="link.url" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.label }}</a></div>
      <p v-if="intent.reviewedAt">Inspection recorded {{ model.time(intent.reviewedAt) }}: {{ intent.reviewNote }}</p>
    </li></ol>
  </section>
</template>
