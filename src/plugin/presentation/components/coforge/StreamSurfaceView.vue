<script setup lang="ts">
import type { StreamSurface } from "../../../features/coforge/domain/stream-surfaces";
import type { StreamSurfaceSource } from "../../../features/coforge/application/stream-surface-ports";
import { useStreamSurface } from "../../composables/coforge/use-stream-surface";
import MarkdownBody from "./MarkdownBody.vue";
const props = defineProps<{
  surface: StreamSurface;
  source: StreamSurfaceSource;
  embedded?: boolean;
}>();
const model = useStreamSurface(props);
</script>
<template>
  <component :is="embedded ? 'section' : 'main'" class="cf-stream-surface" :class="`cf-stream-surface-${surface}`">
    <header>
      <h1>{{ model.title.value }}</h1>
      <p v-if="surface === 'kanban'">
        {{ model.state.value.board.project }} ·
        {{ model.state.value.board.projectId }}
      </p>
    </header>
    <div v-if="surface === 'kanban'" class="cf-stream-kanban">
      <section
        v-for="column in model.state.value.board.columns"
        :key="column.id"
        :aria-label="column.title"
      >
        <h2>
          {{ column.title }} <small>{{ column.count }}</small>
        </h2>
        <p v-if="!column.count">No requests here yet.</p>
        <article v-for="idea in column.ideas" :key="idea.id">
          <div>
            <code>{{ idea.id }}</code
            ><span>{{ idea.votes }} votes</span>
          </div>
          <h3>{{ idea.title }}</h3>
          <MarkdownBody :source="idea.description" compact :links="false" />
          <p>by {{ idea.author }}</p>
          <details v-if="idea.contexts.length">
            <summary>Community context</summary>
            <div v-for="(context, index) in idea.contexts" :key="index">
              <strong>{{ context.author }}</strong
              ><MarkdownBody :source="context.text" :links="false" />
            </div>
          </details>
        </article>
        <p v-if="column.count > column.ideas.length">
          Showing {{ column.ideas.length }} of {{ column.count }} requests.
        </p>
      </section>
    </div>
    <section v-else-if="surface === 'chat'" aria-label="Public Twitch chat">
      <p v-if="!model.state.value.chat.connected">
        Waiting for live Twitch chat. Messages appear when the connection is ready.
      </p>
      <p v-else-if="!model.state.value.chat.messages.length">
        Waiting for chat…
      </p>
      <ol class="cf-stream-chat">
        <li
          v-for="message in model.state.value.chat.messages"
          :key="message.key"
        >
          <strong>{{ message.name }}</strong>
          <p>{{ message.text }}</p>
        </li>
      </ol>
    </section>
    <div v-else-if="surface === 'leaderboards'" class="cf-stream-leaders">
      <section v-for="board in model.boards.value" :key="board.name">
        <h2>{{ board.name }}</h2>
        <p v-if="!board.entries.length">The first contribution starts here.</p>
        <ol>
          <li v-for="entry in board.entries" :key="entry.name">
            <strong>{{ entry.name }}</strong
            ><span>{{ entry.value }} {{ board.unit }}</span>
          </li>
        </ol>
      </section>
    </div>
    <section v-else aria-label="Public community recognition">
      <p>
        Celebrating every {{ model.state.value.community.actorName }} who helps
        build this world.
      </p>
      <p v-if="!model.state.value.community.contributors.length">
        Community achievements will appear here.
      </p>
      <ul class="cf-stream-community">
        <li
          v-for="person in model.state.value.community.contributors"
          :key="person.name"
        >
          <h2>{{ person.name }}</h2>
          <p
            v-for="badge in person.badges.filter((badge) => badge.earned)"
            :key="badge.id"
          >
            {{ badge.title }}
          </p>
        </li>
      </ul>
    </section>
  </component>
</template>
