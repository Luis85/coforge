<script setup lang="ts">
import { useTwitch } from "../../composables/coforge/use-twitch";
const model = useTwitch();
</script>
<template>
  <section aria-label="Chat moderation">
    <details
      class="cf-twitch-moderation"
      :open="Boolean(model.store.moderationTarget)"
    >
      <summary>Moderation</summary>
      <form @submit="model.prepareModeration">
        <fieldset :disabled="!model.state.canModerate || model.checking">
          <legend>Review a moderation action</legend>
          <label class="cf-field"
            ><span>Action</span
            ><select v-model="model.moderation.action">
              <option value="delete">Delete one message</option>
              <option value="timeout">Time out a viewer</option>
              <option value="ban">Ban a viewer</option>
            </select></label
          >
          <label v-if="model.moderation.action === 'delete'" class="cf-field"
            ><span>Twitch message ID</span
            ><input
              v-model="model.moderation.messageId"
              type="text"
              required
              maxlength="200"
          /></label>
          <template v-else>
            <label class="cf-field"
              ><span>Twitch username</span
              ><input
                v-model="model.moderation.login"
                type="text"
                required
                maxlength="25"
                autocomplete="off"
            /></label>
            <label v-if="model.moderation.action === 'timeout'" class="cf-field"
              ><span>Timeout in seconds</span
              ><input
                v-model.number="model.moderation.duration"
                type="number"
                min="1"
                max="1209600"
                required
            /></label>
            <label class="cf-field"
              ><span>Reason (optional)</span
              ><input
                v-model="model.moderation.reason"
                type="text"
                maxlength="500"
            /></label>
          </template>
          <button type="submit" class="cf-btn cf-btn-secondary">
            Review action
          </button>
        </fieldset>
      </form>
      <div
        v-if="model.confirmation"
        class="cf-twitch-confirmation"
        role="group"
        aria-label="Confirm moderation"
      >
        <p>{{ model.confirmation.text }}</p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.cancelModeration()"
          >
            Cancel</button
          ><button
            type="button"
            class="cf-btn cf-btn-danger"
            :disabled="model.checking"
            @click="model.confirmModeration()"
          >
            Confirm action
          </button>
        </div>
      </div>
    </details>
    <p v-if="model.error" class="cf-inline-error" role="alert">
      {{ model.error }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </section>
</template>
