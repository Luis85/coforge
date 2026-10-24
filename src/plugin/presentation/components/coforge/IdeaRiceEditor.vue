<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
import { useIdeaRiceEditor } from '../../composables/coforge/use-idea-rice-editor';
import CfIcon from './CfIcon.vue';

const props = defineProps<{ idea: Idea }>();
const drawer = useIdeaDrawerContext();
const rice = useIdeaRiceEditor(props);
</script>
<template>
  <section v-if="idea.rice" class="cf-idea-section">
    <div class="cf-idea-section-heading">
      <h3><CfIcon name="sparkles" /> Prioritization</h3>
      <button
        type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" :disabled="rice.locked" :aria-expanded="rice.editing"
        @click="rice.toggle()"
      >
        <CfIcon name="pencil" size="sm" />
        {{ rice.editing ? 'Cancel edit' : 'Adjust score' }}
      </button>
    </div>
    <div class="cf-idea-rice-equation">
      <div><strong>{{ rice.reach }}</strong><span>Reach</span></div>
      <b aria-hidden="true">×</b>
      <div><strong>{{ idea.rice.impact }}</strong><span>Impact</span></div>
      <b aria-hidden="true">×</b>
      <div><strong>{{ rice.confidence }}</strong><span>Confidence</span></div>
      <b aria-hidden="true">÷</b>
      <div><strong>{{ idea.rice.effort }}</strong><span>Effort</span></div>
      <b aria-hidden="true">=</b>
      <div class="cf-idea-rice-total"><strong>{{ rice.score }}</strong><span>RICE</span></div>
    </div>
    <p class="cf-idea-rationale">{{ idea.rice.rationale }}</p>
    <p class="cf-idea-help">
      Reach estimates distinct players over 30 days. Effort is in person-days. Votes express community interest; they do not
      replace the reach estimate.
    </p>
    <form v-if="rice.editing" class="cf-idea-rice-form" @submit.prevent="rice.save()">
      <div class="cf-idea-fields-grid">
        <label class="cf-field cf-idea-field">
          <span>Reach · players</span>
          <input v-model.number="rice.draft.reach" type="number" min="0" max="1000000" step="1" required>
        </label>
        <label class="cf-field cf-idea-field">
          <span>Impact</span>
          <select v-model.number="rice.draft.impact">
            <option v-for="option in rice.impactOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="cf-field cf-idea-field">
          <span>Confidence · 0 to 1</span>
          <input v-model.number="rice.draft.confidence" type="number" min="0" max="1" step="0.05" required>
        </label>
        <label class="cf-field cf-idea-field">
          <span>Effort · person-days</span>
          <input v-model.number="rice.draft.effort" type="number" min="0.1" max="365" step="0.1" required>
        </label>
      </div>
      <label class="cf-field cf-idea-field">
        <span>Scoring rationale</span>
        <textarea v-model="rice.draft.rationale" rows="3" required minlength="3" maxlength="3000" />
      </label>
      <div class="cf-idea-form-footer">
        <span class="cf-idea-help">Updated score: <strong>{{ rice.preview }}</strong></span>
        <button class="cf-btn cf-btn-primary" type="submit" :disabled="drawer.isBusy">Save score</button>
      </div>
    </form>
  </section>
</template>
