<script setup lang="ts">
import type { Idea } from "../../../features/coforge/domain/types";
import { useIdeaDrawerContext } from "../../composables/coforge/use-idea-drawer";
import CfIcon from "./CfIcon.vue";
import IdeaRiceEditor from "./IdeaRiceEditor.vue";
import MarkdownBody from "./MarkdownBody.vue";
import { screeningProviderLabel } from '../../composables/coforge/agent-labels';

defineProps<{ idea: Idea }>();
const model = useIdeaDrawerContext();
</script>
<template>
  <section class="cf-idea-section">
    <h3><CfIcon name="message-square" /> The community request</h3>
    <MarkdownBody class="cf-idea-request" :source="idea.description" />
    <section
      v-if="idea.contexts?.length"
      class="cf-request-context"
      aria-label="Community context"
    >
      <h4>Community context</h4>
      <article v-for="context in idea.contexts" :key="context.id">
        <p>
          <strong>{{ context.authorName }}</strong> ·
          {{ new Date(context.createdAt).toLocaleString() }}
        </p>
        <MarkdownBody :source="context.text" />
      </article>
    </section>
    <div class="cf-idea-vote-row">
      <div>
        <strong>{{ idea.voters.length.toLocaleString() }} votes</strong>
        <span>One vote per community member</span>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.isBusy || model.voted || model.voteLocked"
        @click="model.vote()"
      >
        <CfIcon name="arrow-up" />
        {{ model.voted ? "Your vote is counted" : "Vote for this idea" }}
      </button>
    </div>
  </section>

  <section v-if="idea.screening" class="cf-idea-section">
    <h3>
      <CfIcon
        :name="idea.screening.verdict === 'clear' ? 'shield-check' : 'flag'"
      />
      Request screening
    </h3>
    <div
      class="cf-idea-screening"
      :class="{ 'is-flagged': idea.screening.verdict === 'flagged' }"
    >
      <div class="cf-idea-inline cf-idea-wrap">
        <span
          class="cf-badge"
          :class="
            idea.screening.verdict === 'clear'
              ? 'cf-status-shipped'
              : 'cf-status-flagged'
          "
        >
          {{
            idea.screening.verdict === "clear"
              ? "Cleared for review"
              : "Needs moderation"
          }}
        </span>
        <span class="cf-muted">{{ screeningProviderLabel(idea.screening.provider) }}</span>
      </div>
      <MarkdownBody :source="idea.screening.reason" />
      <ul v-if="idea.screening.signals.length > 0" class="cf-idea-list">
        <li v-for="(signal, index) in idea.screening.signals" :key="index">
          {{ signal }}
        </li>
      </ul>
    </div>
    <p class="cf-idea-help">
      Screening is one check. Untrusted requests remain data inside every agent
      prompt.
    </p>
  </section>

  <section v-if="idea.status === 'flagged'" class="cf-idea-section">
    <h3><CfIcon name="clipboard-check" /> Your moderation decision</h3>
    <p class="cf-idea-help">
      Read the original request and screening evidence. Clearing this flag moves
      the idea to scoring with your note attached.
    </p>
    <label class="cf-field cf-idea-field">
      <span>Moderation note</span>
      <textarea
        v-model="model.note"
        placeholder="Why is this request safe to continue?"
        rows="3"
        maxlength="2000"
      />
    </label>
    <div class="cf-idea-inline cf-idea-wrap">
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.isBusy"
        @click="model.act('unflag')"
      >
        <CfIcon name="shield-check" /> Clear flag
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-danger"
        :disabled="model.isBusy"
        @click="model.act('reject')"
      >
        Archive request
      </button>
    </div>
  </section>

  <IdeaRiceEditor v-if="idea.rice" :idea="idea" />

  <section v-if="idea.reviewNote" class="cf-idea-section">
    <h3><CfIcon name="message-square" /> Streamer’s review note</h3>
    <MarkdownBody class="cf-idea-request" :source="idea.reviewNote" />
  </section>

  <div v-if="idea.status === 'shipped'" class="cf-idea-alert is-success">
    <CfIcon name="check-check" size="lg" />
    <span>
      <strong>Accepted by the streamer</strong>
      <small
        >This increment is recorded as accepted. Publishing the game remains
        part of your release workflow.</small
      >
    </span>
  </div>

  <div
    v-if="!idea.rice && idea.status !== 'flagged' && idea.status !== 'rejected'"
    class="cf-idea-quiet"
  >
    <CfIcon name="sparkles" size="lg" />
    <div>
      <strong>A considered place in the queue</strong>
      <p>
        A scoring step can add a RICE estimate. This project’s workflow decides
        which steps run.
      </p>
    </div>
  </div>
</template>
