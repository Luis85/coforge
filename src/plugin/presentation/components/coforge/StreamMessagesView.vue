<script setup lang="ts">
import { useStreamMessages } from "../../composables/coforge/use-stream-messages";
const model = useStreamMessages();
</script>
<template>
  <section class="cf-stream-messages" aria-label="Recurring bot messages">
    <header>
      <h2>Recurring bot messages</h2>
      <p>
        Post while the stream is live. Each message starts paused; the first
        post follows a full interval. Missed intervals are skipped.
      </p>
    </header>
    <p v-if="!model.enabled" role="status">
      Enable automatic bot messages in Twitch settings before activated messages
      can post.
    </p>
    <form class="cf-stream-message-form" @submit="model.save">
      <h3>{{ model.editing ? "Edit message" : "Add message" }}</h3>
      <label class="cf-field"
        ><span>Message text</span
        ><textarea
          v-model="model.text"
          rows="3"
          maxlength="500"
          required
          placeholder="Join the community with !register"
        ></textarea></label
      ><label class="cf-field"
        ><span>Interval (minutes)</span
        ><input
          v-model.number="model.interval"
          type="number"
          min="1"
          max="240"
          required
      /></label>
      <p>Saving an edited message pauses it for review.</p>
      <div class="cf-settings-actions">
        <button
          type="submit"
          class="cf-btn cf-btn-primary"
          :disabled="model.working"
        >
          {{ model.editing ? "Save message" : "Add message" }}</button
        ><button
          v-if="model.editing"
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.reset()"
        >
          Cancel edit
        </button>
      </div>
    </form>
    <p v-if="!model.rows.length">No recurring messages yet.</p>
    <ol class="cf-stream-message-list">
      <li v-for="message in model.rows" :key="message.id">
        <div>
          <strong>{{ message.status }}</strong
          ><span>Every {{ message.intervalMinutes }} minutes</span>
        </div>
        <p class="cf-stream-message-text">{{ message.text }}</p>
        <p>Last confirmed send: {{ message.sent }}</p>
        <p v-if="message.lastError" class="cf-inline-error">
          {{ message.lastError }}
        </p>
        <p v-if="message.active">Next: {{ message.next }}</p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.working"
            :aria-label="`${message.active ? 'Pause' : 'Activate'} ${message.text}`"
            @click="model.activate(message.id, !message.active)"
          >
            {{ message.active ? "Pause" : "Activate" }}</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.working"
            :aria-label="`Edit ${message.text}`"
            @click="model.edit(message.id)"
          >
            Edit</button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.working"
            :aria-label="`Delete ${message.text}`"
            @click="model.deleting = message.id"
          >
            Delete
          </button>
        </div>
        <div
          v-if="model.deleting === message.id"
          class="cf-twitch-confirmation"
          role="group"
          aria-label="Confirm message deletion"
        >
          <p>Delete this recurring message? Unsent copies will be cancelled.</p>
          <div class="cf-settings-actions">
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.deleting = ''"
            >
              Keep message</button
            ><button
              type="button"
              class="cf-btn cf-btn-danger"
              @click="model.remove()"
            >
              Confirm deletion
            </button>
          </div>
        </div>
      </li>
    </ol>
    <p v-if="model.error" class="cf-inline-error" role="alert">
      {{ model.error }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </section>
</template>
