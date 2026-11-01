<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIdeaSessions } from '../../composables/coforge/use-idea-sessions';
import SessionPeek from './SessionPeek.vue';
const props = defineProps<{ idea: Idea }>();
const model = useIdeaSessions(props);
</script>
<template>
  <section aria-label="Request agent sessions" class="cf-idea-sessions">
    <h3>Sessions</h3>
    <p class="cf-idea-help">Private parent attempts for this request. Select a session to follow recorded observations; opening this view does not dispatch work.</p>
    <div v-if="model.rows.length" class="cf-session-layout">
      <nav aria-label="Parent sessions" class="cf-session-list">
        <ol>
          <li v-for="row in model.rows" :key="row.id">
            <button type="button" class="cf-session-select" :class="{ 'is-selected': model.job?.id === row.id && !model.childId }" :aria-pressed="model.job?.id === row.id && !model.childId" :data-parent-session-id="row.id" @click="model.select(row.id)"><strong>{{ row.title }}</strong><span>{{ row.provider }} · {{ row.status }}</span><small>{{ row.model }} · {{ row.started }}</small></button>
            <ol v-if="row.children.length" class="cf-session-children" aria-label="Observed native assistants">
              <li v-for="child in row.children" :key="child.id"><button type="button" class="cf-session-select" :class="{ 'is-selected': model.job?.id === row.id && model.childId === child.id }" :aria-pressed="model.job?.id === row.id && model.childId === child.id" :data-native-session-id="child.id" @click="model.select(row.id, child.id)"><strong>{{ child.label }}</strong><small>Native assistant · last observed {{ child.status }}</small></button></li>
            </ol>
          </li>
        </ol>
      </nav>
      <SessionPeek :model="model" />
    </div>
    <div v-else class="cf-idea-empty"><h3>No agent sessions yet</h3><p>This request has no captured parent attempts. Its workflow remains separate from session observation.</p></div>
  </section>
</template>
