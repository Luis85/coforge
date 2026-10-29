<script setup lang="ts">
import { usePopulation } from "../../composables/coforge/use-population";
import PlayerDetails from "./PlayerDetails.vue";
const model = usePopulation();
</script>
<template>
  <div class="cf-population-page">
    <header class="cf-page-heading">
      <div>
        <h1>Viewers and players</h1>
        <p>Review profiles, game stats and participation controls. Viewer notes stay private.</p>
      </div>
      <button v-if="model.notesAvailable" type="button" class="cf-btn cf-btn-secondary" :disabled="model.working" @click="model.refreshNotes()">Refresh viewer notes</button>
    </header>
    <section class="cf-decision-brief" aria-label="Viewer participation overview">
      <div>
        <h2>{{ model.total.toLocaleString() }} observed · {{ model.registeredTotal.toLocaleString() }} registered</h2>
        <p>Observed viewers become players with <code>!register</code>. Presence records describe chat activity.</p>
      </div>
      <dl><div><dt>{{ model.currencyName }} in circulation</dt><dd>{{ model.coins.toLocaleString() }}</dd></div></dl>
      <button v-if="model.total > model.registeredTotal" type="button" class="cf-btn cf-btn-secondary" @click="model.showUnregistered()">
        Review {{ model.total - model.registeredTotal }} not registered
      </button>
    </section>
    <p class="cf-population-tracking" role="status">{{ model.tracking }}</p>
    <p v-if="model.notesStatus" class="cf-population-tracking">Private notes: {{ model.notesStatus.saved }} synced · {{ model.notesStatus.pending }} pending<span v-if="model.notesStatus.failed"> · sync needs attention; review vault access or duplicate identities, then refresh</span>.</p>
    <div class="cf-population-toolbar">
      <label class="cf-field"
        ><span>Find a viewer</span><input v-model="model.query" type="search" placeholder="Name or viewer ID"
      /></label>
      <label class="cf-field"
        ><span>Viewer status</span
        ><select v-model="model.filter">
          <option value="all">All observed viewers</option>
          <option value="registered">Registered players</option>
          <option value="unregistered">Not registered</option>
          <option value="active">Active</option>
          <option value="blocked">CoForge blocked</option>
          <option value="muted">Twitch muted</option>
          <option value="banned">Twitch banned</option>
        </select></label
      >
    </div>
    <button v-if="model.filtered && model.matching" type="button" class="cf-btn cf-btn-ghost" aria-label="Clear viewer filters" @click="model.clearFilters()">Clear viewer filters</button>
    <section v-if="!model.total" class="cf-population-empty cf-intent-empty" aria-label="No observed viewers">
      <p>No viewers have been observed yet. Connect Twitch in Stream chat to populate this directory. Viewers join the game with <code>!register</code>.</p>
      <button type="button" class="cf-btn cf-btn-primary" @click="model.openChat()">Open Stream chat</button>
    </section>
    <div v-else class="cf-population-layout">
      <section class="cf-player-list" aria-label="Viewer directory">
        <div class="cf-data-scroll" tabindex="0" role="region" aria-label="Player table">
          <table class="cf-idea-table">
            <thead>
              <tr>
                <th>{{ model.actorName }}</th>
                <th>Status</th>
                <th>Rank</th>
                <th>{{ model.currencyName }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="player in model.rows"
                :key="player.id"
                :class="{ 'is-selected': model.selectedId === player.id }"
              >
                <td>
                  <button
                    type="button"
                    class="cf-player-name"
                    :aria-pressed="model.selectedId === player.id"
                    @click="model.select(player.id)"
                  >
                    {{ player.name }}<small>{{ player.id }}</small>
                  </button>
                </td>
                <td>{{ player.status }}</td>
                <td>{{ player.rankName }}</td>
                <td>{{ player.coins.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!model.matching" class="cf-intent-empty"><p>No viewers match this search or status.</p><button type="button" class="cf-btn cf-btn-secondary" @click="model.clearFilters()">Clear viewer filters</button></div>
        <div class="cf-player-pagination">
          <span>{{ model.matching }} matching · Page {{ model.page + 1 }} of {{ model.pages }}</span
          ><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.page === 0" @click="model.page--">
            Previous</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.page + 1 >= model.pages"
            @click="model.page++"
          >
            Next
          </button>
        </div>
      </section>
      <PlayerDetails v-if="model.selected" :model="model" />
      <p v-else class="cf-player-detail-empty">Select a viewer to inspect their profile, game stats and participation controls.</p>
    </div>
    <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </div>
</template>
