<script setup lang="ts">
import { useTwitch } from "../../composables/coforge/use-twitch";
const model = useTwitch();
</script>
<template>
  <section class="cf-twitch-channel-editor" aria-label="Twitch channel editor">
    <h2>Channel details</h2>
    <p v-if="!model.state.canManage" class="cf-settings-help">
      Connect the streamer account with channel permissions to edit Twitch.
    </p>
    <form @submit="model.saveChannel">
      <fieldset :disabled="!model.state.canManage || model.checking">
        <legend>Stream metadata</legend>
        <label class="cf-field"
          ><span>Stream title</span><input v-model="model.title" type="text" maxlength="140" required
        /></label>
        <div class="cf-twitch-category-search">
          <label class="cf-field"
            ><span>Find a category</span><input v-model="model.categoryQuery" type="search" maxlength="100" /></label
          ><button type="button" class="cf-btn cf-btn-secondary" @click="model.search()">Search categories</button>
        </div>
        <label class="cf-field"
          ><span>Category</span
          ><select v-model="model.categoryId">
            <option :value="model.state.channel?.categoryId || ''">
              {{ model.state.channel?.categoryName || "No category" }}
            </option>
            <option v-for="category in model.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select></label
        >
        <label class="cf-field"
          ><span>Channel tags (comma separated)</span
          ><input
            v-model="model.tags"
            aria-label="Channel tags (comma separated)"
            type="text"
            maxlength="300"
            placeholder="GameDevelopment, Community"
          /><small>Up to 10 unique tags, 1–25 letters or numbers each, without spaces.</small></label
        >
        <label class="cf-field"
          ><span>Broadcast language</span
          ><input
            v-model="model.language"
            aria-label="Broadcast language"
            type="text"
            maxlength="5"
            placeholder="en"
          /><small>Two-letter code such as en or de, or other.</small></label
        >
        <div class="cf-settings-actions">
          <button type="button" class="cf-btn cf-btn-secondary" @click="model.refresh()">Refresh channel</button
          ><button type="submit" class="cf-btn cf-btn-primary">Save channel details</button>
        </div>
      </fieldset>
    </form>
    <div class="cf-channel-branding">
      <h3>Channel branding</h3>
      <p>
        Edit profile images, banners and accent color in Twitch’s branding editor. Edit panels on your Twitch channel’s
        About page.
      </p>
      <a
        v-if="model.brandingUrl"
        :href="model.brandingUrl"
        @click="model.openBranding()"
        target="_blank"
        rel="noopener noreferrer"
        >Open Twitch branding editor</a
      >
      <p v-else>Connect the streamer account to open its branding editor.</p>
    </div>
    <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </section>
</template>
