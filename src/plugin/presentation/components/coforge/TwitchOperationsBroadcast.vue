<script setup lang="ts">
import { useTwitchBroadcast } from '../../composables/coforge/use-twitch-broadcast';
const broadcast = useTwitchBroadcast();
</script>
<template>
  <div class="cf-twitch-operation-broadcast">
    <section aria-label="Ad break timing">
      <h2>Ad break timing</h2><p>{{ broadcast.adStatus }}</p>
      <dl><dt>Next scheduled ad</dt><dd><span data-twitch-ad-countdown role="timer" aria-live="off">{{ broadcast.adCountdown }}</span></dd><dt>Available snoozes</dt><dd>{{ broadcast.snoozes ?? 'Unavailable' }}</dd><dt>Pre-roll-free time</dt><dd>{{ broadcast.preRollCountdown }}</dd></dl>
      <p class="cf-twitch-operation-freshness">Observed {{ broadcast.adObserved }}. Timing becomes stale after one minute.</p>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!broadcast.canSnooze" @click="broadcast.prepareSnooze()">Prepare ad snooze</button>
    </section>
    <section aria-label="Raid preparation">
      <h2>Prepare a raid</h2><p>Preview the destination before handing over your community. Previewing never starts a raid.</p>
      <label v-if="broadcast.shortlist.length" class="cf-field"><span>Raid shortlist</span><select v-model="broadcast.selectedTemplate" aria-label="Raid shortlist" @change="broadcast.selectShortlist()"><option value="">Choose a saved raid template</option><option v-for="template in broadcast.shortlist" :key="template.id" :value="template.id">{{ template.name }}</option></select></label>
      <p v-else class="cf-twitch-operation-hint">Save named Start raid templates in Channel actions below to build a shortlist.</p>
      <div class="cf-twitch-operation-lookup"><label class="cf-field"><span>Raid target channel ID</span><input v-model="broadcast.targetId" aria-label="Raid target channel ID" inputmode="numeric" /></label><button type="button" data-twitch-raid-preview class="cf-btn cf-btn-secondary" :disabled="!broadcast.canPreview || broadcast.previewBusy || !broadcast.targetId.trim()" @click="broadcast.previewRaid()">{{ broadcast.previewBusy ? 'Checking target…' : 'Preview raid target' }}</button></div>
      <p v-if="!broadcast.canPreview" class="cf-twitch-operation-hint">Raid target previews are available with the connected Twitch account in Obsidian.</p>
      <p v-if="broadcast.previewError" role="alert" class="cf-twitch-operation-error">{{ broadcast.previewError }}</p>
      <p v-if="broadcast.expiredTarget" class="cf-twitch-operation-hint">Target preview expired. Preview it again before reviewing a raid.</p>
      <div v-if="broadcast.raidTarget" aria-label="Raid target preview" class="cf-twitch-operation-raid-preview">
        <h3>{{ broadcast.raidTarget.name }}</h3><p>{{ broadcast.raidTarget.title }}</p><p>{{ broadcast.raidTarget.categoryName || 'Category unavailable' }} · {{ broadcast.raidTarget.isLive ? 'Live' : 'Offline' }}<span v-if="broadcast.raidTarget.viewers !== null"> · {{ broadcast.raidTarget.viewers }} viewers</span></p>
        <p class="cf-twitch-operation-freshness">Verified {{ broadcast.model.time(broadcast.raidTarget.checkedAt) }}. Preview is valid for 30 seconds.</p>
        <div class="cf-settings-actions"><a :href="broadcast.targetUrl" target="_blank" rel="noopener noreferrer">Open target channel</a><button type="button" data-twitch-raid-prepare class="cf-btn cf-btn-secondary" :disabled="!broadcast.raidTarget.isLive || broadcast.model.store.busy" @click="broadcast.prepareRaid()">Prepare raid action</button></div>
      </div>
    </section>
  </div>
</template>
