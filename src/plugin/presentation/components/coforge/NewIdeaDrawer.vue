<script setup lang="ts">
import { useNewIdeaDrawer } from '../../composables/coforge/use-new-idea';
import CfIcon from './CfIcon.vue';

const model = useNewIdeaDrawer();
</script>
<template>
  <div class="cf-overlay" @mousedown="model.focus.backdrop">
    <section
      :ref="model.focus.bind" class="cf-drawer cf-new-idea-drawer" role="dialog" aria-modal="true"
      aria-labelledby="cf-new-idea-title" @keydown="model.focus.keydown"
    >
      <header class="cf-new-idea-header">
        <span class="cf-drawer-symbol"><CfIcon name="lightbulb" size="lg" /></span>
        <button type="button" class="cf-icon-button" aria-label="Close new idea" @click="model.close()">
          <CfIcon name="x" size="lg" />
        </button>
      </header>
      <div class="cf-new-idea-heading">
        <h2 id="cf-new-idea-title">New request</h2>
        <p>The request belongs to the selected project.</p>
      </div>
      <form @submit.prevent="model.submit()">
        <label class="cf-field"><span>Request type</span><select v-model="model.requestKind"><option value="feature">Feature request</option><option value="bug">Bug report</option></select></label>
        <label class="cf-field">
          <span>The idea</span>
          <input
            v-model="model.title" type="text" placeholder="What if we could befriend forest creatures?"
            minlength="5" maxlength="120" required
          >
          <small>A short, specific description of the feature.</small>
        </label>
        <label class="cf-field">
          <span>A little more context</span>
          <textarea v-model="model.description" placeholder="How would it work? What would make it fun?" rows="5" maxlength="1200" />
        </label>
        <div class="cf-form-two-columns">
          <label class="cf-field">
            <span>Category</span>
            <select v-model="model.category">
              <option v-for="item in model.categories" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label class="cf-field">
            <span>Contributor name</span>
            <input v-model="model.username" type="text" minlength="2" maxlength="30" required>
          </label>
        </div>
        <div class="cf-submission-note">
          <span class="cf-status-dot is-active" />
          <p>Gets an idea ID, enters screening, and stays linked to its contributor.</p>
        </div>
        <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
        <div class="cf-form-actions">
          <button type="button" class="cf-btn cf-btn-secondary" @click="model.close()">Cancel</button>
          <button type="submit" class="cf-btn cf-btn-primary" :disabled="!model.canSubmit">
            {{ model.busy ? 'Adding idea…' : 'Add to the board' }}
            <CfIcon name="arrow-right" />
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
