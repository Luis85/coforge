<script setup lang="ts">
import type { PopulationModel } from "../../composables/coforge/use-population";
defineProps<{ model: PopulationModel }>();
</script>
<template>
  <aside v-if="model.selected" class="cf-player-detail" aria-label="Player details">
    <header>
      <h2>{{ model.selected.name }}</h2>
      <code>{{ model.selected.id }}</code>
      <p>{{ model.actorName }} · {{ model.selected.status }}</p>
      <button v-if="model.canOpenNote" type="button" class="cf-btn cf-btn-secondary" :disabled="model.working" @click="model.openNote()">Open private viewer note</button>
    </header>
    <section class="cf-player-actions" aria-label="CoForge participation">
      <h3>Participation</h3>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.working"
          @click="model.prepare(model.selected.blocked ? 'unblock' : 'block')"
        >
          {{ model.selected.blocked ? "Unblock participation" : "Block participation" }}
        </button>
      </div>
      <p>Blocks requests, bugs, context, votes and rewards; keeps history and balances.</p>
    </section>
    <section v-if="model.selected.twitchId" class="cf-player-actions" aria-label="Twitch player moderation">
      <h3>Twitch moderation</h3>
      <p>Last checked: {{ model.selected.restrictionChecked }}</p>
      <p v-if="model.selected.uncertain" role="alert">
        A moderation result is unconfirmed. Refresh from Twitch before another action.
      </p>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          aria-label="Mute"
          :disabled="!model.canModerate || model.working"
          @click="model.prepare('timeout')"
        >
          Mute ({{ model.duration }}s)</button
        ><button
          type="button"
          class="cf-btn cf-btn-danger"
          :disabled="!model.canModerate || model.working"
          @click="model.prepare('ban')"
        >
          Ban</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.canModerate || model.working || (!model.selected.muted && !model.selected.banned)"
          @click="model.prepare('unban')"
        >
          Unmute / unban</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.canRefresh || model.working"
          @click="model.refresh()"
        >
          Refresh Twitch status
        </button>
      </div>
      <details>
        <summary>Timeout and reason</summary>
        <label class="cf-field"
          ><span>Mute duration (seconds)</span
          ><input
            :value="model.duration" @input="model.setDuration($event)"
            type="number"
            min="1"
            max="1209600"
            :disabled="!model.canModerate || model.working" /></label
        ><label class="cf-field"
          ><span>Moderation reason (optional)</span
          ><input :value="model.reason" @input="model.setReason($event)" type="text" maxlength="500" :disabled="!model.canModerate || model.working"
        /></label>
      </details>
      <p v-if="!model.canModerate && !model.selected.uncertain">
        Connect the streamer account with moderation permissions to use these controls.
      </p>
    </section>
    <p v-else>Local test profile. Twitch moderation is unavailable.</p>
    <div v-if="model.confirmation" class="cf-twitch-confirmation" role="group" aria-label="Confirm player action">
      <p>{{ model.confirmation.text }}</p>
      <div class="cf-settings-actions">
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.cancel()">Cancel</button
        ><button type="button" class="cf-btn cf-btn-danger" :disabled="model.working" @click="model.confirm()">
          Confirm {{ model.confirmation.action === "timeout" ? "mute" : model.confirmation.action }}
        </button>
      </div>
    </div>
    <dl class="cf-player-stats">
      <div>
        <dt>Rank</dt>
        <dd>{{ model.selected.rankName }}</dd>
      </div>
      <div>
        <dt>XP</dt>
        <dd>{{ model.selected.xp }}</dd>
      </div>
      <div>
        <dt>{{ model.currencyName }}</dt>
        <dd>{{ model.selected.coins }}</dd>
      </div>
      <div>
        <dt>Reputation</dt>
        <dd>{{ model.selected.reputation }}</dd>
      </div>
      <div>
        <dt>Chat-presence minutes</dt>
        <dd>{{ model.selected.minutes }}</dd>
      </div>
      <div>
        <dt>Features / bugs</dt>
        <dd>{{ model.selected.features }} / {{ model.selected.bugs }}</dd>
      </div>
      <div>
        <dt>Votes cast</dt>
        <dd>{{ model.selected.votes }}</dd>
      </div>
      <div>
        <dt>Accepted contributions</dt>
        <dd>{{ model.selected.accepted }}</dd>
      </div>
    </dl>
    <p>{{ model.selected.rankProgress }}</p>
    <p>Registered: {{ model.selected.registered }}</p>
    <p>Last observed: {{ model.selected.lastSeen }}</p>
    <p>Feature cooldown: {{ model.selected.cooldown ? `${model.selected.cooldown} seconds remaining` : "Ready" }}</p>
    <details>
      <summary>Recent rewards ({{ model.rewards.length }})</summary>
      <ul v-if="model.rewards.length" class="cf-reward-list">
        <li v-for="reward in model.rewards" :key="reward.id">
          {{ reward.reason }}{{ reward.ideaId ? ` · ${reward.ideaId}` : "" }}: +{{ reward.coins }}
          {{ model.currencyName }} · +{{ reward.xp }} XP · +{{ reward.reputation }} reputation
        </li>
      </ul>
      <p v-else>No rewards recorded yet.</p>
    </details>
  </aside>
</template>
