<script setup lang="ts">
import { useObsShow } from "../../composables/coforge/use-obs-show";
import ObsShowSteps from "./ObsShowSteps.vue";
import ObsShowRundown from "./ObsShowRundown.vue";
const model = useObsShow();
</script>
<template>
  <section
    class="cf-production-show"
    aria-label="Show plans and cues"
    :aria-busy="model.ui.pending"
  >
    <header class="cf-production-heading">
      <div>
        <h2>Show plan</h2>
        <p>
          Prepare reusable segments, review every action and run each cue
          explicitly.
        </p>
      </div>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.production.supported ||
            !model.production.connected ||
            model.production.ui.pending ||
            model.ui.pending
          "
          @click="model.production.refresh()"
        >
          Refresh OBS targets
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.ui.pending || model.ui.dirty"
          @click="model.create()"
        >
          Create show plan
        </button>
      </div>
    </header>
    <p v-if="!model.supported">
      Show plans run inside the Obsidian plugin. This preview cannot change OBS.
    </p>
    <p v-if="model.ui.error" class="cf-inline-error" role="alert">
      {{ model.ui.error }}
    </p>
    <p v-if="model.ui.notice" role="status">{{ model.ui.notice }}</p>
    <p v-if="model.ui.pending" role="status">Completing show action…</p>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Saved show plan</span
        ><select
          v-model="model.ui.selectedPlan"
          :disabled="model.ui.dirty || model.ui.pending"
        >
          <option value="">Choose a saved plan</option>
          <option
            v-for="plan in model.state.plans"
            :key="plan.id"
            :value="plan.id"
          >
            {{ plan.name }}
          </option>
        </select></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.ui.selectedPlan || model.ui.dirty || model.ui.pending"
        @click="model.load()"
      >
        Load show plan
      </button>
    </div>
    <p v-if="!model.state.plans.length && !model.ui.draft">
      Create your first plan to prepare Starting soon, Development, Council,
      Playtest, BRB and Ending segments. Matching scenes are added when
      available; review the actions before saving. Creating a plan never changes
      OBS.
    </p>
    <ObsShowRundown />
    <template v-if="model.ui.draft">
      <fieldset
        class="cf-production-plan-editor cf-show-draft-fields"
        :disabled="model.ui.pending"
      >
        <legend>Edit show plan</legend>
        <label class="cf-field"
          ><span>Show plan name</span
          ><input
            v-model="model.ui.draft.name"
            maxlength="150"
            @input="model.markDirty()"
        /></label>
        <div class="cf-production-fields">
          <label class="cf-field"
            ><span>Segment to edit</span
            ><select v-model="model.ui.selectedCue">
              <option
                v-for="segment in model.ui.draft.segments"
                :key="segment.id"
                :value="segment.id"
              >
                {{ segment.name }}
              </option>
            </select></label
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.addCue()"
          >
            Add segment</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.ui.draft.segments.length <= 1"
            @click="model.removeCue()"
          >
            Remove segment from draft
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.canMoveCueEarlier"
            @click="model.moveCue(-1)"
          >
            Move segment earlier
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.canMoveCueLater"
            @click="model.moveCue(1)"
          >
            Move segment later
          </button>
        </div>
        <template v-if="model.cue">
          <div class="cf-production-fields">
            <label class="cf-field"
              ><span>Segment name</span
              ><input
                v-model="model.cue.name"
                maxlength="150"
                @input="model.markDirty()" /></label
            ><label class="cf-field"
              ><span>Planned duration (seconds)</span
              ><input
                v-model.number="model.cue.durationSeconds"
                @input="model.markDirty()"
                type="number"
                min="0"
                max="14400"
              /><small
                >Zero means no countdown. A timer never switches scenes
                automatically.</small
              ></label
            >
          </div>
          <label class="cf-field"
            ><span>Private presenter notes</span
            ><textarea
              v-model="model.cue.note"
              rows="3"
              maxlength="4000"
              @input="model.markDirty()"
            />
          </label>
          <ObsShowSteps />
        </template>
        <details class="cf-production-advanced">
          <summary>Opt-in event cues</summary>
          <p>
            Bindings start disabled. Enable the intended bindings, save the
            plan, then resume event cues. Reload pauses automation; missed
            events are never replayed.
          </p>
          <div class="cf-production-fields">
            <label class="cf-field"
              ><span>Event for selected segment</span
              ><select v-model="model.ui.event">
                <option
                  v-for="event in model.events"
                  :key="event"
                  :value="event"
                >
                  {{ event }}
                </option>
              </select></label
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.addBinding()"
            >
              Add disabled event binding
            </button>
          </div>
          <div
            v-for="binding in model.ui.draft.bindings"
            :key="binding.id"
            class="cf-production-output-row"
          >
            <label class="cf-project-repository-toggle"
              ><input
                v-model="binding.enabled"
                type="checkbox"
                @change="model.markDirty()"
              /><span
                >{{ binding.event }} →
                {{
                  model.ui.draft.segments.find(
                    (segment) => segment.id === binding.cueId,
                  )?.name
                }}</span
              ></label
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.removeBinding(binding.id)"
            >
              Remove binding
            </button>
          </div>
        </details>
      </fieldset>
      <div class="cf-settings-actions cf-production-save">
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="!model.supported || !model.ui.dirty || model.ui.pending"
          @click="model.save()"
        >
          Save show plan</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.ui.dirty || model.ui.pending"
          @click="model.discard()"
        >
          Discard plan draft</button
        ><span v-if="model.ui.dirty" role="status"
          >Unsaved changes · cue execution uses saved definitions.</span
        >
      </div>
      <section class="cf-production-section" aria-label="Event cue automation">
        <h3>Event cues</h3>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.ui.pending"
          @click="model.automation()"
        >
          {{
            model.state.automationEnabled
              ? "Pause event cues"
              : "Resume event cues"
          }}
        </button>
        <p>
          {{
            model.state.automationEnabled
              ? "Saved enabled event bindings are active while CoForge is open."
              : "Event cues are paused."
          }}
        </p>
      </section>
      <details class="cf-production-advanced">
        <summary>Remove saved show plan</summary>
        <p>
          Remove {{ model.saved?.name }} and its event bindings. Existing run
          evidence remains.
        </p>
        <p v-if="model.ui.dirty">
          Save or discard your changes before removing this plan.
        </p>
        <label class="cf-project-repository-toggle"
          ><input
            v-model="model.ui.deleteConfirmation"
            type="checkbox"
            :disabled="model.ui.dirty || model.ui.pending || !model.saved"
          /><span>Remove this saved plan</span></label
        ><button
          type="button"
          class="cf-btn cf-btn-danger"
          :disabled="
            !model.ui.deleteConfirmation ||
            !model.saved ||
            model.ui.pending ||
            model.ui.dirty
          "
          @click="model.deletePlan()"
        >
          Confirm plan removal
        </button>
      </details>
    </template>
    <section class="cf-production-section" aria-label="Stream moment markers">
      <h3>Stream moments</h3>
      <div class="cf-production-fields">
        <label class="cf-field"
          ><span>Moment label</span
          ><input v-model="model.ui.marker" maxlength="150" /></label
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.supported || !model.ui.marker.trim() || model.ui.pending
          "
          @click="model.addMarker()"
        >
          Mark stream moment
        </button>
      </div>
      <ol>
        <li v-for="marker in model.recentMarkers" :key="marker.id">
          {{ marker.label }} · {{ marker.at }}
        </li>
      </ol>
    </section>
  </section>
</template>
