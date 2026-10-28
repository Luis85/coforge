<script setup lang="ts">
import {
  useCouncilMessages,
  type CouncilMessagingActions,
} from "../../composables/coforge/use-council-messages";
const props = defineProps<{
  actions: CouncilMessagingActions;
  teamId: string;
}>();
const model = useCouncilMessages(props);
</script>
<template>
  <section aria-label="Team messages">
    <h3>Team messages</h3>
    <p>
      Share context for the team's next runs. Information and replies do not
      start tasks.
    </p>
    <p v-if="model.store.error" role="alert" class="cf-inline-error">
      {{ model.store.error }}
    </p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    <form @submit.prevent="model.post()">
      <label for="cf-team-information">Information for this team</label>
      <textarea
        id="cf-team-information"
        v-model="model.store.draft"
        aria-label="Information for this team"
        maxlength="16000"
        rows="4"
        :disabled="!teamId || model.store.busy"
      />
      <div class="cf-settings-actions">
        <button
          type="submit"
          class="cf-btn cf-btn-primary"
          :disabled="!teamId || !model.store.draft.trim() || model.store.busy"
        >
          Post information
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy"
          @click="model.repair()"
        >
          Repair pending deliveries
        </button>
      </div>
    </form>
    <p v-if="!model.messages.value.length">
      No messages for this team. Saved messages will show their sender, purpose
      and delivery status here.
    </p>
    <ol v-else>
      <li v-for="entry in model.messages.value" :key="entry.message.id">
        <article>
          <h4>
            {{ entry.message.purpose }} · {{ entry.message.senderId }} →
            {{ entry.message.recipientId }}
          </h4>
          <p>
            <time :datetime="entry.message.createdAt">{{
              entry.message.createdAt
            }}</time>
            · {{ entry.status }}
          </p>
          <p>{{ entry.message.body }}</p>
          <p v-if="entry.reason" role="status">{{ entry.reason }}</p>
          <p>
            Thread: <code>{{ entry.message.threadId }}</code> · Root:
            <code>{{ entry.message.rootId }}</code>
          </p>
          <p v-if="entry.message.replyTo">
            Reply to: <code>{{ entry.message.replyTo }}</code>
          </p>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.store.busy"
            @click="model.stop(entry.message.rootId)"
          >
            Stop this conversation
          </button>
        </article>
      </li>
    </ol>
  </section>
</template>
