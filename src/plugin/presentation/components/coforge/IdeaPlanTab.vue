<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
import { useIdeaPlan } from '../../composables/coforge/use-idea-plan';
import { useIdeaDesign } from '../../composables/coforge/use-idea-design';
import CfIcon from './CfIcon.vue';
import MarkdownBody from './MarkdownBody.vue';
import CurrentPolishedResult from './CurrentPolishedResult.vue';

const props = defineProps<{ idea: Idea }>();
const drawer = useIdeaDrawerContext();
const plan = useIdeaPlan(props);
const design = useIdeaDesign(props);
</script>
<template>
  <template v-if="idea.plan">
    <section class="cf-idea-section" aria-label="Implementation plan">
      <div class="cf-idea-section-heading">
        <h3><CfIcon name="list-checks" /> Implementation plan</h3>
        <button
          type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" title="The plan is also saved in the idea note"
          @click="plan.copy()"
        >
          <CfIcon name="copy" size="sm" /> Copy Markdown
        </button>
      </div>
      <MarkdownBody class="cf-idea-body" :source="idea.plan.summary" />
      <ol class="cf-idea-plan-steps">
        <li v-for="(step, index) in idea.plan.steps" :key="index">
          <span>{{ index + 1 }}</span>
          <MarkdownBody :source="step" />
        </li>
      </ol>
    </section>
    <section class="cf-idea-section">
      <h3><CfIcon name="clipboard-check" /> Acceptance criteria</h3>
      <ul class="cf-idea-check-list">
        <li v-for="(criterion, index) in idea.plan.acceptanceCriteria" :key="index">
          <span class="cf-idea-check-box" aria-hidden="true" />
          <MarkdownBody :source="criterion" />
        </li>
      </ul>
    </section>
    <section v-if="idea.plan.risks.length > 0" class="cf-idea-section">
      <h3><CfIcon name="circle-alert" /> Assumptions & risks</h3>
      <ul class="cf-idea-list">
        <li v-for="(risk, index) in idea.plan.risks" :key="index"><MarkdownBody :source="risk" /></li>
      </ul>
    </section>
    <p class="cf-idea-help">{{ plan.savedLabel }}</p>
  </template>
  <section v-else class="cf-idea-section" aria-label="Implementation plan">
    <h3><CfIcon name="list-checks" /> Implementation plan <span class="cf-badge">Not saved</span></h3>
    <p class="cf-idea-help">No plan yet. A planning step can save proposed changes and acceptance criteria here.</p>
    <button v-if="idea.status === 'ranked'" type="button" class="cf-btn cf-btn-secondary" :disabled="drawer.isBusy" @click="drawer.act('plan')">
      Create a plan <CfIcon name="arrow-right" />
    </button>
  </section>
  <section class="cf-idea-section" aria-label="Design specification">
    <template v-if="design.markdown">
      <div class="cf-idea-section-heading">
        <h3><CfIcon name="pencil-ruler" /> Design specification</h3>
        <button type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" @click="design.copy()">
          <CfIcon name="copy" size="sm" /> Copy Design Markdown
        </button>
      </div>
      <MarkdownBody class="cf-idea-body" :source="design.markdown" />
      <p class="cf-idea-help">{{ design.savedLabel }}</p>
    </template>
    <template v-else>
      <h3><CfIcon name="pencil-ruler" /> Design specification <span class="cf-badge">Not saved</span></h3>
      <p class="cf-idea-help">No design specification yet. The standard workflow saves one after Plan for Build to use. Earlier or invalidated results remain in Workflow runs.</p>
    </template>
    <button v-if="drawer.workflowVisible" type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" @click="drawer.openWorkflow()">{{ idea.workflowRun ? 'Inspect workflow evidence' : 'Open workflow' }}</button>
  </section>
  <CurrentPolishedResult :idea="idea" />
</template>
