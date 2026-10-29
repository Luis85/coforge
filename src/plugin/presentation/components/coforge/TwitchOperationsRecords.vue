<script setup lang="ts">
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
const model = useTwitchOperationsSection();
</script>
<template>
  <section class="cf-twitch-operation-records" aria-label="Current Twitch data">
    <div class="cf-twitch-operation-read-toolbar">
      <label class="cf-field"><span>Dataset</span><select v-model="model.store.resource" aria-label="Twitch dataset" @change="model.setResource(model.store.resource)"><option v-for="resource in model.resources" :key="resource.name" :value="resource.name">{{ resource.label }}</option></select></label>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.supported || model.store.busy" @click="model.refresh()">Refresh data</button>
      <button v-if="model.canAuthorize && model.missingReadScopes.length" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.authorize(model.store.resource)">Authorize data access</button>
    </div>
    <p v-if="model.selectedResource?.note">{{ model.selectedResource.note }}</p>
    <div v-if="model.store.resource === 'redemptions'" class="cf-twitch-operation-fields">
      <label class="cf-field"><span>Reward ID</span><input v-model="model.store.query.reward_id" list="cf-twitch-reward-options" /><datalist id="cf-twitch-reward-options"><option v-for="reward in model.rewardOptions" :key="reward.id" :value="reward.id">{{ reward.title }}</option></datalist></label>
      <label class="cf-field"><span>Redemption state</span><select v-model="model.store.query.status"><option>UNFULFILLED</option><option>FULFILLED</option><option>CANCELED</option></select></label>
    </div>
    <p class="cf-twitch-operation-freshness">{{ model.resourceState?.checkedAt ? `Collected ${model.time(model.resourceState.checkedAt)}` : 'Not collected in this session' }}<span v-if="model.resourceState?.status === 'loading'"> · Refreshing…</span><span v-if="model.resourceState?.result?.total !== undefined"> · Twitch reports {{ model.resourceState.result.total }} total</span></p>
    <p v-if="model.resourceState?.error" role="alert" class="cf-twitch-operation-error">{{ model.resourceState.error }}</p>
    <p v-if="!model.records.length" class="cf-twitch-operation-empty">{{ model.resourceState?.status === 'ready' ? 'Twitch returned no records for this selection.' : 'Refresh to retrieve the available data. Missing data does not mean zero activity.' }}</p>
    <ol v-else class="cf-twitch-operation-record-list">
      <li v-for="(record, index) in model.records" :key="index">
        <dl><template v-for="field in model.recordFields(record)" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></template></dl>
        <button v-if="model.actions.length" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.useRecord(record)">Use record in action</button>
      </li>
    </ol>
    <button v-if="model.resourceState?.result?.cursor" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.refresh(true)">Load next page</button>
  </section>
</template>
