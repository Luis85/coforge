<script setup lang="ts">
import { useRequestObjectSettings } from '../../composables/coforge/use-request-object-settings';
const model = useRequestObjectSettings();
</script>
<template>
  <section class="cf-request-object-settings cf-settings-section" aria-label="Project Request Object">
    <header><h2>Request Object</h2><p>Choose the class and additional properties for new requests in this project. Existing notes keep their captured format and values.</p></header>
    <label class="cf-field"><span>Request note class</span><input v-model="model.className" aria-label="Request note class" :aria-describedby="`${model.settings.store.layoutId}-request-class-help`" maxlength="80" placeholder="Business Idea or Feature Idea"><small :id="`${model.settings.store.layoutId}-request-class-help`">Stored as request-class in Markdown frontmatter. Leave blank to omit the class label; additional fields can still be configured.</small></label>
    <label class="cf-field"><span>Request categories</span><textarea :value="model.categoriesText" aria-label="Request categories" :aria-describedby="`${model.settings.store.layoutId}-request-categories-help`" rows="5" @change="model.setCategories($event)" required></textarea><small :id="`${model.settings.store.layoutId}-request-categories-help`">One category per line. The first is the default for chat intake. Keep at least one; changes apply to new requests, while older categories remain filterable.</small></label>
    <div class="cf-request-schema-heading"><h3>Additional fields</h3><span>{{ model.fields.length }} / {{ model.limit }}</span></div>
    <p class="cf-settings-help">All fields are optional. Chat requests use configured defaults; the streamer can edit captured values privately. Keys become native note properties and cannot replace CoForge or Obsidian properties.</p>
    <ol class="cf-request-schema-list">
      <li v-for="(field, index) in model.fields" :key="index">
        <div class="cf-request-schema-row">
          <label class="cf-field"><span>Field {{ index + 1 }} label</span><input v-model="field.label" maxlength="80" required placeholder="Target audience"></label>
          <label class="cf-field"><span>Field {{ index + 1 }} property key</span><input v-model="field.key" maxlength="64" required placeholder="target_audience" spellcheck="false"></label>
          <label class="cf-field"><span>Field {{ index + 1 }} type</span><select :value="field.type" @change="model.setType(index, $event)"><option v-for="type in model.types" :key="type" :value="type">{{ type }}</option></select></label>
        </div>
        <label v-if="field.type === 'select'" class="cf-field"><span>Field {{ index + 1 }} options</span><textarea :value="field.options.join('\n')" rows="3" @change="model.setOptions(field, $event)" placeholder="One option per line" required></textarea></label>
        <label v-if="field.type === 'checkbox'" class="cf-request-schema-checkbox"><input type="checkbox" :checked="field.defaultValue === true" @change="model.setDefault(index, $event)"><span>Field {{ index + 1 }} default checked</span></label>
        <label v-else class="cf-field"><span>Field {{ index + 1 }} default value</span><select v-if="field.type === 'select'" :value="field.defaultValue ?? ''" @change="model.setDefault(index, $event)"><option value="">No default</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select><input v-else :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'" :value="field.defaultValue ?? ''" step="any" :maxlength="field.type === 'text' ? 2000 : undefined" @input="model.setDefault(index, $event)"></label>
        <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-ghost" @click="model.clearDefault(index)">Clear default for field {{ index + 1 }}</button><button type="button" class="cf-btn cf-btn-secondary" :disabled="index === 0" :aria-label="`Move up field ${index + 1}`" @click="model.move(index, -1)">Move up</button><button type="button" class="cf-btn cf-btn-secondary" :disabled="index + 1 === model.fields.length" :aria-label="`Move down field ${index + 1}`" @click="model.move(index, 1)">Move down</button><button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Remove field ${index + 1}`" @click="model.remove(index)">Remove field</button></div>
      </li>
    </ol>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.fields.length >= model.limit" @click="model.add()">Add request field</button>
    <p class="cf-settings-help">Save project settings to use this definition for new manual, chat and API requests. Defining fields does not publish their values to viewers.</p>
  </section>
</template>
