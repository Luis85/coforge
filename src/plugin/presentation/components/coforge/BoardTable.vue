<script setup lang="ts">
import { useBoardView } from '../../composables/coforge/use-board';
import CfIcon from './CfIcon.vue';
import RequestDeleteButton from './RequestDeleteButton.vue';

const model = useBoardView();
</script>
<template>
  <div class="cf-idea-table-wrap">
    <table class="cf-idea-table">
      <thead>
        <tr>
          <th>Idea</th>
          <th>Contributor</th>
          <th>Status</th>
          <th>Votes</th>
          <th>RICE</th>
          <th><span class="cf-sr-only">Request actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in model.rows" :key="row.id">
          <td>
            <button type="button" class="cf-table-idea" @click="model.open(row.id)">
              <span class="cf-mono cf-muted">{{ row.id }}</span>
              <strong>{{ row.title }}</strong>
            </button>
          </td>
          <td>{{ row.contributor }}</td>
          <td><span class="cf-badge" :class="`cf-status-${row.status}`">{{ row.statusLabel }}</span></td>
          <td class="cf-mono">{{ row.votes }}</td>
          <td class="cf-mono">{{ row.rice }}</td>
          <td>
            <div class="cf-table-request-actions">
            <RequestDeleteButton :idea-id="row.id" icon-only />
            <button type="button" class="cf-icon-button" :aria-label="`Open ${row.id}`" @click="model.open(row.id)">
              <CfIcon name="arrow-up-right" />
            </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
