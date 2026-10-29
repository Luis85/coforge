<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
import ObsLayoutEditor from "./ObsLayoutEditor.vue";
import ObsFilterEditor from "./ObsFilterEditor.vue";
const model = useObsProduction();
</script>
<template>
  <section
    class="cf-production-source-editor"
    aria-label="Source properties and layouts"
  >
    <header class="cf-production-heading">
      <div>
        <h2>Sources &amp; layouts</h2>
        <p>
          Add supported sources, edit their properties and position them
          precisely.
        </p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || !model.connected || model.ui.pending"
        @click="model.refresh()"
      >
        Refresh sources
      </button>
    </header>
    <p v-if="!model.ui.snapshot">
      Connect OBS in Setup, then refresh sources to begin.
    </p>
    <div v-else>
      <section class="cf-production-section" aria-label="Create an OBS source">
        <h3>Add a source</h3>
        <div class="cf-production-fields">
          <label class="cf-field"
            ><span>Destination scene</span
            ><select v-model="model.ui.selectedScene">
              <option value="">Choose a scene</option>
              <option
                v-for="scene in model.scenes"
                :key="scene.id"
                :value="scene.id"
              >
                {{ scene.name }}
              </option>
            </select></label
          >
          <label class="cf-field"
            ><span>Source name</span
            ><input v-model="model.ui.sourceName" maxlength="128"
          /></label>
          <label class="cf-field"
            ><span>Source type</span
            ><select v-model="model.ui.inputKind">
              <option value="">Choose an available type</option>
              <option
                v-for="kind in model.ui.snapshot.inputKinds"
                :key="kind"
                :value="kind"
              >
                {{ model.inputLabel(kind) }}
              </option>
            </select></label
          >
          <label class="cf-field"
            ><span>Initial text, URL, media file or device value</span
            ><input v-model="model.ui.sourceValue" maxlength="2000" /><small
              >For device sources, leave blank to use its default, then choose
              the device below.</small
            ></label
          >
        </div>
        <label class="cf-project-repository-toggle"
          ><input v-model="model.ui.sourceEnabled" type="checkbox" /><span
            >Show the new source immediately</span
          ></label
        >
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.canChange ||
            !model.supports('input-create') ||
            !model.ui.sourceName.trim() ||
            !model.ui.inputKind ||
            !model.ui.selectedScene
          "
          @click="model.createSource()"
        >
          Create source
        </button>
      </section>
      <section
        class="cf-production-section"
        aria-label="Edit selected OBS source"
      >
        <h3>Source properties</h3>
        <label class="cf-field"
          ><span>Source to edit</span
          ><select v-model="model.ui.selectedInput">
            <option value="">Choose a source</option>
            <option
              v-for="input in model.ui.snapshot.inputs"
              :key="input.id"
              :value="input.id"
            >
              {{ input.name }} · {{ model.inputLabel(input.kind) }}
            </option>
          </select></label
        >
        <p>
          Source properties are shared by every scene that uses this source.
          Changes can affect the live program immediately.
        </p>
        <template v-if="model.selected">
          <div
            v-if="model.isTextInput(model.selected.kind)"
            class="cf-production-fields"
          >
            <label class="cf-field"
              ><span>Source text</span
              ><textarea
                v-model="model.ui.sourceText"
                maxlength="4000"
                rows="3"
              /></label
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.canChange"
              @click="model.saveText()"
            >
              Apply source text
            </button>
          </div>
          <div
            v-if="model.selected.kind.includes('browser')"
            class="cf-production-fields"
          >
            <label class="cf-field"
              ><span>Browser source URL</span
              ><input
                v-model="model.ui.sourceUrl"
                type="url"
                maxlength="2000" /></label
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.canChange || !model.ui.sourceUrl"
              @click="model.saveUrl()"
            >
              Apply browser URL
            </button>
          </div>
          <p v-if="model.hiddenUrl">
            This URL contains hidden credentials. Enter a complete replacement
            to change it.
          </p>
          <div class="cf-production-fields">
            <label class="cf-field"
              ><span>Device/list property</span
              ><input v-model="model.ui.sourceProperty" maxlength="80" /><small
                >For example: device_id, video_device_id, window or
                monitor.</small
              ></label
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="
                !model.connected || model.ui.pending || !model.ui.sourceProperty
              "
              @click="model.readProperties()"
            >
              Find available choices
            </button>
          </div>
          <div
            v-if="model.ui.sourceOptions.length"
            class="cf-production-fields"
          >
            <label class="cf-field"
              ><span>Available choice</span
              ><select v-model="model.ui.sourceOption">
                <option
                  v-for="option in model.ui.sourceOptions"
                  :key="String(option.value)"
                  :value="option.value"
                  :disabled="!option.enabled"
                >
                  {{ option.label }}
                </option>
              </select></label
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.canChange"
              @click="model.saveProperty()"
            >
              Apply source choice
            </button>
          </div>
          <details class="cf-production-advanced">
            <summary>Edit a supported property</summary>
            <div class="cf-production-fields">
              <label class="cf-field"
                ><span>Property value type</span
                ><select v-model="model.ui.propertyValueType">
                  <option value="string">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean (true or false)</option>
                </select></label
              ><label class="cf-field"
                ><span>New property value</span
                ><input
                  v-model="model.ui.propertyValue"
                  maxlength="2000" /></label
              ><button
                type="button"
                class="cf-btn cf-btn-secondary"
                :disabled="!model.canChange || !model.ui.sourceProperty"
                @click="model.saveScalarProperty()"
              >
                Apply supported property
              </button>
            </div>
            <p>
              The property name above must be supported by this source type.
              Invalid settings are rejected before OBS is changed.
            </p>
          </details>
          <details class="cf-production-advanced">
            <summary>Current supported properties</summary>
            <dl class="cf-production-properties">
              <div v-for="(value, key) in model.selected.settings" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </details>
          <div
            v-if="
              model.selected.kind.includes('ffmpeg') ||
              model.selected.kind.includes('vlc')
            "
            class="cf-settings-actions"
          >
            <button
              v-for="action in ['play', 'pause', 'stop', 'restart'] as const"
              :key="action"
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.canChange || !model.supports('media-action')"
              @click="
                model.execute({
                  kind: 'media-action',
                  inputId: model.ui.selectedInput,
                  action,
                })
              "
            >
              {{ action }} media
            </button>
          </div>
          <ObsFilterEditor />
        </template>
      </section>
      <ObsLayoutEditor />
    </div>
  </section>
</template>
