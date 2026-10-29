<script setup lang="ts">
import { useAlerts } from '../../composables/coforge/use-alerts';
import AlertsTemplateEditor from './AlertsTemplateEditor.vue';
import CfIcon from './CfIcon.vue';
const model = useAlerts();
</script>
<template>
  <div class="cf-alerts-page">
    <header class="cf-page-heading">
      <div><h1>Alerts</h1><p>Turn stream moments into text, GIFs, video and sound for your viewers.</p></div>
      <button class="cf-btn cf-btn-secondary" type="button" :disabled="!model.available" @click="model.clear()"><CfIcon name="square" /> Stop all alerts</button>
    </header>
    <p v-if="model.store.error || model.store.state.error" role="alert" class="cf-inline-error">{{ model.store.error || model.store.state.error }}</p>
    <p class="cf-alerts-notice" role="status" aria-label="Alert action result" aria-atomic="true">{{ model.store.notice }}</p>
    <section class="cf-alerts-source" aria-label="OBS Browser Source setup">
      <div class="cf-alerts-connection">
        <p role="status" aria-label="Browser source connection" aria-atomic="true"><CfIcon :name="model.store.state.sources ? 'circle-check' : 'circle'" /> <strong>{{ model.connectionLabel }}</strong></p>
        <p>Connections confirm an open browser page. Check OBS for visible playback and audio.</p>
      </div>
      <details :open="model.store.setupOpen" @toggle="model.toggleSetup($event)">
        <summary :ref="model.bindSetup">OBS source setup</summary>
        <template v-if="model.available">
          <div class="cf-alerts-url-row">
            <label class="cf-field"><span>Alerts URL</span><input readonly :value="model.store.state.url" aria-label="Alerts URL" :aria-describedby="`${model.ids.url}-help`" @focus="model.selectUrl($event)" /></label>
            <button class="cf-btn cf-btn-secondary" type="button" :disabled="model.store.busy" @click="model.copy()"><CfIcon name="copy" /> Copy URL</button>
          </div>
          <p :id="`${model.ids.url}-help`">In OBS, add a Browser Source, leave Local file off and paste this URL. Use your canvas size. Keep Obsidian and CoForge open on this computer.</p>
          <ul class="cf-alerts-setup-help">
            <li><strong>Audio:</strong> enable Control audio via OBS to route sound to its mixer. Use audio monitoring in OBS’s Advanced Audio Properties if you also want to hear it.</li>
            <li><strong>Hidden scenes:</strong> Shutdown source when not visible unloads the page and stops its playback. An unloaded source misses alerts.</li>
            <li><strong>Scene changes:</strong> leave Refresh browser source when scene becomes active off for continuous playback. Refreshing or reconnecting clears playback and receives future alerts only.</li>
          </ul>
          <p>The background is transparent while idle. This URL gives read-only access to prepared alerts and selected media.</p>
        </template>
        <p v-else>Alerts run in desktop Obsidian. If the local source could not start, fix the error above and reload CoForge. Your saved templates stay in the vault’s private plugin data.</p>
      </details>
    </section>
    <div class="cf-alerts-workspace">
      <section aria-label="Saved alerts" class="cf-alerts-library">
        <div class="cf-alerts-section-heading"><h2>Your alerts</h2><button :ref="model.bindNew" type="button" class="cf-btn cf-btn-secondary" :disabled="!model.available || model.store.busy" @click="model.create()"><CfIcon name="plus" /> New alert</button></div>
        <p v-if="!model.store.state.templates.length && !model.unsaved.length">Create your first alert, add text or media, then save it for the stream.</p>
        <ul class="cf-alerts-list">
          <li v-for="item in model.store.state.templates" :key="item.id"><button type="button" :aria-current="model.store.selected === item.id ? 'true' : undefined" :disabled="model.store.busy" @click="model.select(item.id)"><strong>{{ item.name }}</strong><span>{{ model.dirty(item.id) ? 'Unsaved changes · ' : '' }}{{ model.eventLabel(item) }}</span></button></li>
          <li v-for="item in model.unsaved" :key="item.id"><button type="button" :aria-current="model.store.selected === item.id ? 'true' : undefined" :disabled="model.store.busy" @click="model.select(item.id)"><strong>{{ item.name || 'Untitled alert' }}</strong><span>Unsaved draft</span></button></li>
        </ul>
      </section>
      <section v-if="model.draft" class="cf-alerts-editor" aria-label="Alert editor">
        <h2 v-if="!model.saved">Create alert</h2>
        <section v-if="model.saved" class="cf-alerts-dispatch" aria-label="Manual alert dispatch">
          <h2 :ref="model.bindDispatch" tabindex="-1">{{ model.saved.name }}</h2>
          <p class="cf-alerts-meta">{{ model.saved.duration }} seconds · {{ Math.round(model.saved.volume * 100) }}% volume · {{ model.eventLabel(model.saved) }}</p>
          <h3>Fire this alert</h3>
          <p class="cf-alerts-text-preview">{{ model.preview || 'Media-only alert' }}</p>
          <label v-for="key in model.keys" :key="key" class="cf-field"><span>{{ key }}</span><input :value="model.variables[key] || ''" maxlength="500" :disabled="model.store.busy" @input="model.setVariable(key, $event)" /></label>
          <p v-if="model.changed">You have unsaved changes. Save or discard them before firing.</p>
          <p v-if="!model.store.state.sources">No source can receive this alert yet. Add the URL to an enabled OBS Browser Source and keep it loaded.</p>
          <div class="cf-settings-actions">
            <button :ref="model.bindFire" type="button" class="cf-btn cf-btn-primary" :disabled="!model.available || !model.store.state.sources || model.changed || model.store.busy" @click="model.fire()"><CfIcon name="play" /> Fire alert to OBS</button>
            <button v-if="!model.store.state.sources" type="button" class="cf-btn cf-btn-secondary" @click="model.showSetup()">Show OBS setup</button>
          </div>
        </section>
        <AlertsTemplateEditor :model="model" />
        <div v-if="model.store.deleting === model.store.selected" class="cf-alerts-delete">
          <p>Delete “{{ model.saved?.name || model.draft.name }}” and its automatic binding?</p>
          <div class="cf-settings-actions"><button :ref="model.bindConfirm" type="button" class="cf-btn cf-btn-danger" :disabled="model.store.busy" @click="model.remove()">Delete this alert</button><button type="button" class="cf-btn cf-btn-ghost" :disabled="model.store.busy" @click="model.cancelDelete()">Keep alert</button></div>
        </div>
        <button v-else-if="model.saved" :ref="model.bindDelete" type="button" class="cf-btn cf-btn-ghost" :disabled="model.store.busy" @click="model.markDelete()">Delete alert…</button>
      </section>
    </div>
  </div>
</template>
