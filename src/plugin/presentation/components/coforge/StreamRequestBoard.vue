<script setup lang="ts">
import type { StreamSurfaceSnapshot } from "../../../features/coforge/domain/stream-surfaces";
import MarkdownBody from "./MarkdownBody.vue";
defineProps<{ board: StreamSurfaceSnapshot["board"] }>();
</script>
<template>
  <section aria-label="Public project requests">
    <div class="cf-stream-board-summary">
      <p>
        <strong>{{ board.screenedRequests }}</strong> screened requests
        <span v-if="board.awaitingScreening"
          >· {{ board.awaitingScreening }} awaiting screening</span
        >
      </p>
      <p>Community ideas become reviewed game changes.</p>
    </div>
    <div class="cf-stream-kanban">
      <section
        v-for="column in board.columns"
        :key="column.id"
        :aria-label="column.title"
        :data-column="column.id"
      >
        <h2>
          {{ column.title }}
          <span class="cf-stream-count">{{ column.count }}</span>
        </h2>
        <p v-if="!column.count" class="cf-stream-empty">
          {{
            column.id === "done"
              ? "Accepted contributions will appear here."
              : column.id === "progress"
                ? "The next build starts here."
                : column.id === "next"
                  ? "Scored ideas waiting for planning appear here."
                  : column.id === "design"
                    ? "Planned requests prepare their specification here."
                    : "Requests appear after screening."
          }}
        </p>
        <article
          v-for="idea in column.ideas"
          :key="idea.id"
          class="cf-stream-request"
        >
          <div class="cf-stream-request-ref">
            <code>{{ idea.id }}</code
            ><strong
              >{{ idea.votes }}
              {{ idea.votes === 1 ? "vote" : "votes" }}</strong
            >
          </div>
          <h3>{{ idea.title }}</h3>
          <MarkdownBody
            class="cf-stream-request-description"
            :source="idea.description"
            compact
            :links="false"
          />
          <div class="cf-stream-request-meta">
            <span>{{ idea.category }}</span
            ><span v-if="idea.rice !== null"
              >RICE
              {{
                idea.rice.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })
              }}</span
            >
          </div>
          <p class="cf-stream-request-credit">
            {{ idea.status }} · by {{ idea.author }}
          </p>
          <div v-if="idea.contexts.length" class="cf-stream-context">
            <strong>Latest community context</strong>
            <p>{{ idea.contexts.at(-1)?.author }}</p>
            <MarkdownBody
              :source="idea.contexts.at(-1)?.text ?? ''"
              compact
              :links="false"
            />
          </div>
        </article>
        <p v-if="column.count > column.ideas.length" class="cf-stream-muted">
          Showing {{ column.ideas.length }} of {{ column.count }} requests.
        </p>
      </section>
    </div>
  </section>
</template>
