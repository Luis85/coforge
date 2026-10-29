<script setup lang="ts">
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
const model = useTwitchOperationsSection();
</script>
<template>
  <section aria-label="Twitch data catalogue" class="cf-twitch-operation-catalogue">
    <h2>Data & access</h2>
    <p>Each dataset uses its own permissions. Collected information stays private; anonymous video viewers, exact watch time, payout data and viewers’ Channel Points balances are unavailable.</p>
    <div class="cf-data-scroll" role="region" aria-label="Dataset access and freshness" tabindex="0">
      <table class="cf-idea-table"><thead><tr><th>Dataset</th><th>Access</th><th>Last collected</th><th>Permission</th></tr></thead>
        <tbody><tr v-for="entry in model.catalogue" :key="entry.name">
          <td><strong>{{ entry.label }}</strong><p v-if="entry.note">{{ entry.note }}</p></td>
          <td>{{ entry.capability?.available ? 'Authorized' : entry.capability?.missingScopes.length ? 'Permission needed' : 'Connect Twitch' }}<p v-if="entry.state?.error">{{ entry.state.error }}</p></td>
          <td>{{ model.time(entry.state?.checkedAt) }}<small v-if="entry.state">{{ entry.state.status }}</small></td>
          <td><button v-if="model.canAuthorize" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.authorize(entry.name)">Authorize {{ entry.label }}</button><span v-else>{{ entry.scopes.length ? 'Connect in Twitch settings' : 'Connected account' }}</span></td>
        </tr></tbody>
      </table>
    </div>
    <form class="cf-twitch-operation-retention" @submit.prevent="model.setRetention()">
      <label class="cf-field"><span>Private activity retention in days</span><input v-model.number="model.store.retentionDays" type="number" min="1" max="365" required /></label>
      <button type="submit" class="cf-btn cf-btn-secondary" :disabled="!model.supported || model.store.busy">Save retention</button>
    </form>
    <p>Retention applies to observed activity. Unconfirmed action evidence stays available for recovery.</p>
    <section v-if="model.snapshot.gaps.length" aria-label="Collection gaps">
      <h3>Collection gaps</h3>
      <ul><li v-for="(gap, index) in model.snapshot.gaps" :key="index">{{ model.time(gap.startedAt) }} – {{ gap.endedAt ? model.time(gap.endedAt) : 'ongoing' }} · {{ gap.reason }} · channel {{ gap.channelId }}</li></ul>
    </section>
  </section>
</template>
