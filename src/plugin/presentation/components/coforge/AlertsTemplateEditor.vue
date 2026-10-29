<script setup lang="ts">
import type { useAlerts } from '../../composables/coforge/use-alerts';
defineProps<{ model: ReturnType<typeof useAlerts> }>();
</script>
<template>
  <details v-if="model.draft" class="cf-alerts-template" :open="model.editorOpen" @toggle="model.toggleEditor($event)">
    <summary>{{ model.saved ? 'Edit alert' : 'Template settings' }}</summary>
    <form @submit.prevent="model.save()">
      <fieldset :disabled="model.store.busy || !model.available">
        <legend>Text and media</legend>
        <p class="cf-settings-help">Alert name is required. Add text or at least one media file. Media files must already exist in the vault and be no larger than 25 MiB each.</p>
        <label class="cf-field"><span>Alert name</span><input :ref="model.bindName" :value="model.draft.name" required maxlength="100" @input="model.updateText('name', $event)" /></label>
        <label class="cf-field"><span :id="`${model.ids.text}-label`">Text template</span><textarea :value="model.draft.text" rows="3" maxlength="2000" placeholder="Thanks, {{viewer}}!" :aria-labelledby="`${model.ids.text}-label`" :aria-describedby="`${model.ids.text}-help`" @input="model.updateText('text', $event)" /><small :id="`${model.ids.text}-help`">Use simple named variables, for example <code v-pre>{{viewer}}</code>. Text is displayed literally. Keep messages short for on-air readability; long text scales to fit the source.</small></label>
        <div class="cf-alerts-fields">
          <label class="cf-field"><span :id="`${model.ids.image}-label`">Image or GIF</span><input :value="model.draft.image" :list="model.mediaIds.image" :aria-labelledby="`${model.ids.image}-label`" :aria-describedby="`${model.ids.image}-help`" placeholder="CoForge/Alerts/celebrate.gif" @input="model.updateText('image', $event)" /><small :id="`${model.ids.image}-help`">Optional vault-relative path: GIF, PNG, JPEG or WebP.</small></label>
          <label class="cf-field"><span :id="`${model.ids.audio}-label`">Audio</span><input :value="model.draft.audio" :list="model.mediaIds.audio" :aria-labelledby="`${model.ids.audio}-label`" :aria-describedby="`${model.ids.audio}-help`" placeholder="CoForge/Alerts/fanfare.mp3" @input="model.updateText('audio', $event)" /><small :id="`${model.ids.audio}-help`">Optional vault-relative path: MP3, WAV, OGG or M4A.</small></label>
          <label class="cf-field"><span :id="`${model.ids.video}-label`">Video</span><input :value="model.draft.video" :list="model.mediaIds.video" :aria-labelledby="`${model.ids.video}-label`" :aria-describedby="`${model.ids.video}-help`" placeholder="CoForge/Alerts/celebrate.webm" @input="model.updateText('video', $event)" /><small :id="`${model.ids.video}-help`">Optional vault-relative path: MP4 or WebM.</small></label>
        </div>
        <datalist :id="model.mediaIds.image"><option v-for="path in model.imageFiles" :key="path" :value="path" /></datalist>
        <datalist :id="model.mediaIds.audio"><option v-for="path in model.audioFiles" :key="path" :value="path" /></datalist>
        <datalist :id="model.mediaIds.video"><option v-for="path in model.videoFiles" :key="path" :value="path" /></datalist>
        <div class="cf-alerts-fields">
          <label class="cf-field"><span :id="`${model.ids.duration}-label`">Duration (seconds)</span><input :value="model.draft.duration" type="number" min="1" max="120" required :aria-labelledby="`${model.ids.duration}-label`" :aria-describedby="`${model.ids.duration}-help`" @input="model.updateNumber('duration', $event)" /><small :id="`${model.ids.duration}-help`">1–120 seconds. All media stops when the alert ends.</small></label>
          <label class="cf-field"><span :id="`${model.ids.volume}-label`">Volume (0–1)</span><input :value="model.draft.volume" type="number" min="0" max="1" step="0.05" required :aria-labelledby="`${model.ids.volume}-label`" :aria-describedby="`${model.ids.volume}-help`" @input="model.updateNumber('volume', $event)" /><small :id="`${model.ids.volume}-help`">0 is silent; 1 is full volume. Also applies to video audio.</small></label>
        </div>
        <h3>Automatic trigger</h3>
        <label class="cf-field"><span :id="`${model.ids.event}-label`">CoForge event</span><select :value="model.draft.event" :aria-labelledby="`${model.ids.event}-label`" :aria-describedby="`${model.ids.event}-help`" @change="model.changeEvent($event)"><option value="">No event — manual only</option><option v-for="event in model.events" :key="event.id" :value="event.id">{{ event.label }}</option></select><small :id="`${model.ids.event}-help`">Choose a moment in CoForge, then explicitly enable automatic dispatch below. Saving the template never fires it.</small></label>
        <label class="cf-alerts-check"><input :checked="model.draft.enabled" type="checkbox" :disabled="!model.draft.event" :aria-describedby="`${model.ids.automatic}-help`" @change="model.enableAutomatic($event)" /> Enable automatic dispatch for this event</label>
        <p v-if="model.selectedEvent" class="cf-settings-help">Variables available for {{ model.selectedEvent.label }}: <code v-for="key in model.automaticVariables" :key="key">{{ key }} </code></p>
        <p :id="`${model.ids.automatic}-help`" class="cf-settings-help">Viewer requires an available public display name. Request, title and project require a screened public request. Private request events and local chat tests are skipped. Missing event values skip that alert and show an error.</p>
        <p v-if="model.automaticProblem" role="alert" class="cf-inline-error">{{ model.automaticProblem }}</p>
        <div class="cf-settings-actions"><button type="submit" class="cf-btn cf-btn-primary" :disabled="!model.changed || Boolean(model.automaticProblem)">{{ model.store.busy ? 'Saving…' : 'Save alert' }}</button><button type="button" class="cf-btn cf-btn-ghost" :disabled="!model.changed" @click="model.discard()">Discard changes</button></div>
      </fieldset>
    </form>
  </details>
</template>
