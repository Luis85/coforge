<script setup lang="ts">
import { usePopulation } from "../../composables/coforge/use-population";
import PlayerDetails from "./PlayerDetails.vue";
const model = usePopulation();
</script>
<template>
  <div class="cf-population-page">
    <header class="cf-page-heading">
      <div>
        <h1>Players</h1>
        <p>{{ model.total }} registered · {{ model.coins.toLocaleString() }} {{ model.currencyName }} in circulation</p>
      </div>
    </header>
    <p class="cf-population-tracking" role="status">{{ model.tracking }}</p>
    <div class="cf-population-toolbar">
      <label class="cf-field"
        ><span>Find a player</span><input v-model="model.query" type="search" placeholder="Name or player ID"
      /></label>
      <label class="cf-field"
        ><span>Player status</span
        ><select v-model="model.filter">
          <option value="all">All registered players</option>
          <option value="active">Active</option>
          <option value="blocked">CoForge blocked</option>
          <option value="muted">Twitch muted</option>
          <option value="banned">Twitch banned</option>
        </select></label
      >
    </div>
    <p v-if="!model.total" class="cf-population-empty">
      No registered players yet. Viewers join with <code>!register</code>. Existing contributors keep their history and
      register explicitly.
    </p>
    <div v-else class="cf-population-layout">
      <section class="cf-player-list" aria-label="Registered players">
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
        <p v-if="!model.matching">No players match this search or status.</p>
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
      <p v-else class="cf-player-detail-empty">Select a player to view stats, rewards and moderation controls.</p>
    </div>
    <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </div>
</template>
