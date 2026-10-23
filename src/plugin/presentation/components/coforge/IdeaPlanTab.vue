<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
import { useIdeaPlan } from '../../composables/coforge/use-idea-plan';
import CfIcon from './CfIcon.vue';

const props = defineProps<{ idea: Idea }>();
const drawer = useIdeaDrawerContext();
const plan = useIdeaPlan(props);
</script>
<template>
  <template v-if="idea.plan">
    <section class="cf-idea-section">
      <div class="cf-idea-section-heading">
        <h3><CfIcon name="list-checks" /> Implementation plan</h3>
        <button
          type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" title="The plan is also saved in the idea note"
          @click="plan.copy()"
        >
          <CfIcon name="copy" size="sm" /> Copy Markdown
        </button>
      </div>
      <p class="cf-idea-body">{{ idea.plan.summary }}</p>
      <ol class="cf-idea-plan-steps">
        <li v-for="(step, index) in idea.plan.steps" :key="index">
          <span>{{ index + 1 }}</span>
          <p>{{ step }}</p>
        </li>
      </ol>
    </section>
    <section class="cf-idea-section">
      <h3><CfIcon name="clipboard-check" /> Acceptance criteria</h3>
      <ul class="cf-idea-check-list">
        <li v-for="(criterion, index) in idea.plan.acceptanceCriteria" :key="index">
          <span class="cf-idea-check-box" aria-hidden="true" />
          <span>{{ criterion }}</span>
        </li>
      </ul>
    </section>
    <section v-if="idea.plan.risks.length > 0" class="cf-idea-section">
      <h3><CfIcon name="circle-alert" /> Assumptions & risks</h3>
      <ul class="cf-idea-list">
        <li v-for="(risk, index) in idea.plan.risks" :key="index">{{ risk }}</li>
      </ul>
    </section>
    <p class="cf-idea-help">{{ plan.savedLabel }}</p>
  </template>
  <div v-else class="cf-idea-empty">
    <CfIcon name="list-checks" size="lg" />
    <h3>No plan yet</h3>
    <p>After screening and scoring, the planning agent will save its implementation steps and acceptance criteria here.</p>
    <button v-if="idea.status === 'ranked'" type="button" class="cf-btn cf-btn-secondary" :disabled="drawer.isBusy" @click="drawer.act('plan')">
      Create a plan <CfIcon name="arrow-right" />
    </button>
  </div>
</template>
