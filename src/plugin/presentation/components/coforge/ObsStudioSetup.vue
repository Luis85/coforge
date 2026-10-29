<script setup lang="ts">
import { useObsStudioSetup } from "../../composables/coforge/use-obs-studio-setup";
import ObsOutputSetup from "./ObsOutputSetup.vue";
import ObsOutputControls from "./ObsOutputControls.vue";
const model = useObsStudioSetup();
</script>
<template>
  <section class="cf-production-studio-setup" aria-label="Create my studio">
    <header class="cf-production-heading">
      <div>
        <h2>Create my studio</h2>
        <p>
          Start with a blank OBS installation and build a complete set of scenes
          for your show.
        </p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.production.connected || model.production.ui.pending"
        @click="model.production.refresh()"
      >
        Read OBS capabilities
      </button>
    </header>
    <p v-if="!model.supported || !model.production.connected">
      Open OBS, enable its authenticated WebSocket server and connect above.
      Studio creation never starts a broadcast.
    </p>
    <p v-if="model.ui.error" class="cf-inline-error" role="alert">
      {{ model.ui.error }}
    </p>
    <p v-if="model.ui.notice" role="status">{{ model.ui.notice }}</p>
    <div @input="model.invalidate()">
      <label class="cf-field"
        ><span>Studio scene prefix</span
        ><input v-model="model.ui.draft.prefix" maxlength="50" /><small
          >For example, CoForge creates CoForge Development and CoForge
          BRB.</small
        ></label
      >
    </div>
    <ul class="cf-production-starter-scenes">
      <li v-for="role in model.roles" :key="role">{{ model.names[role] }}</li>
    </ul>
    <section class="cf-production-section" aria-label="Studio source choices">
      <h3>Choose your sources</h3>
      <p>
        Add the captures, microphone, camera or media you want to use. Device
        sources start with OBS defaults. Create the reviewed studio first, then
        choose your actual camera, microphone or window from the available
        device choices in Sources &amp; layouts. Choices become available after
        OBS has created the source; creation does not verify its capture.
      </p>
      <div class="cf-production-fields">
        <label class="cf-field"
          ><span>New studio source name</span
          ><input v-model="model.ui.sourceName" maxlength="100" /></label
        ><label class="cf-field"
          ><span>Available source type</span
          ><select v-model="model.ui.sourceKind">
            <option value="">Read capabilities, then choose a type</option>
            <option
              v-for="kind in model.production.ui.snapshot?.inputKinds"
              :key="kind"
              :value="kind"
            >
              {{ model.production.inputLabel(kind) }}
            </option>
          </select></label
        >
      </div>
      <details class="cf-production-advanced">
        <summary>Initial source property (optional)</summary>
        <div class="cf-production-fields">
          <label class="cf-field"
            ><span>Property name</span
            ><input v-model="model.ui.property" maxlength="80" /><small
              >Examples: text, file, local_file, url, device_id or
              video_device_id.</small
            ></label
          ><label class="cf-field"
            ><span>Property value</span
            ><input v-model="model.ui.value" maxlength="2000"
          /></label>
        </div>
      </details>
      <fieldset>
        <legend>Use this source in</legend>
        <label
          v-for="role in model.roles"
          :key="role"
          class="cf-project-repository-toggle"
          ><input
            v-model="model.ui.roles"
            type="checkbox"
            :value="role"
          /><span>{{ model.names[role] }}</span></label
        >
      </fieldset>
      <label class="cf-project-repository-toggle"
        ><input v-model="model.ui.enabled" type="checkbox" /><span
          >Show this source immediately in its scenes</span
        ></label
      >
      <p>
        This reviewed setup runs while OBS is off air. Added sources appear in
        their scenes unless you clear the checkbox. Shared sources use the same
        device and settings across their scenes.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.ui.sourceName.trim() ||
          !model.ui.sourceKind ||
          !model.ui.roles.length ||
          model.ui.draft.sources.length >= 30
        "
        @click="model.addSource()"
      >
        Add source to studio draft
      </button>
      <ol class="cf-production-step-list">
        <li v-for="(source, index) in model.ui.draft.sources" :key="index">
          <span
            ><strong>{{ source.name }}</strong> · {{ source.inputKind }} ·
            {{ source.roles.join(", ") }} ·
            {{ source.enabled ? "visible" : "hidden" }}</span
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.removeSource(index)"
          >
            Remove source from draft
          </button>
        </li>
      </ol>
    </section>
    <div class="cf-production-fields" @change="model.invalidate()">
      <label class="cf-project-repository-toggle"
        ><input
          v-model="model.titlesEnabled"
          type="checkbox"
          :disabled="!model.titleKind"
        /><span
          >Add readable Starting soon, BRB and Ending title slates</span
        ></label
      >
      <label class="cf-project-repository-toggle"
        ><input v-model="model.ui.includeVideo" type="checkbox" /><span
          >Include the video settings below in this creation plan</span
        ></label
      >
      <label class="cf-project-repository-toggle"
        ><input v-model="model.ui.includeOutputPreset" type="checkbox" /><span
          >Include the output preset below · OBS restart required</span
        ></label
      >
    </div>
    <button
      type="button"
      class="cf-btn cf-btn-primary"
      :disabled="
        !model.supported || !model.production.canChange || model.ui.pending
      "
      @click="model.preview()"
    >
      Preview studio creation
    </button>
    <section
      v-if="model.ui.preview"
      class="cf-production-review"
      aria-label="Review studio creation"
    >
      <h3>Review the studio</h3>
      <ul>
        <li v-for="scene in model.ui.preview.scenes" :key="scene.role">
          {{ scene.name }} ·
          {{ scene.existingId ? "already exists" : "create" }}
        </li>
      </ul>
      <ol>
        <li v-for="step in model.ui.preview.steps" :key="step">{{ step }}</li>
      </ol>
      <label class="cf-project-repository-toggle"
        ><input v-model="model.ui.confirmed" type="checkbox" /><span
          >Create the reviewed scenes and sources in this OBS installation</span
        ></label
      ><button
        type="button"
        class="cf-btn cf-btn-primary"
        :disabled="
          !model.ui.confirmed || model.ui.pending || !model.production.canChange
        "
        @click="model.apply()"
      >
        Create reviewed studio
      </button>
    </section>
    <section
      v-if="model.state"
      class="cf-production-section"
      aria-label="Studio creation progress"
    >
      <h3>Studio creation · {{ model.state.status }}</h3>
      <p>
        {{ model.state.completed.length }} of {{ model.state.total }} steps
        confirmed.
      </p>
      <p v-if="model.state.lastError" class="cf-inline-error">
        {{ model.state.lastError }}
      </p>
      <button
        v-if="
          model.state.status === 'failed' || model.state.status === 'uncertain'
        "
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.ui.pending"
        @click="model.recover()"
      >
        Acknowledge inspected partial setup
      </button>
    </section>
    <section
      v-if="model.created"
      class="cf-production-review"
      aria-label="Test the created studio"
    >
      <h3>Choose devices and verify the picture</h3>
      <p>
        The scenes and sources are created. Select the actual microphone, camera
        or capture window, make its scene visible in Program or Preview, and
        check the resulting picture and audio before rehearsal.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        @click="model.openSources()"
      >
        Choose devices and test captures
      </button>
    </section>
    <ObsOutputSetup />
    <section class="cf-production-section" aria-label="Rehearse the studio">
      <h3>Rehearse before going live</h3>
      <p>
        Use a short recording to check the selected capture, microphone, game
        sound and music. Review it in your usual player, then finish the
        readiness review above. OBS accepting a destination does not verify
        delivery to Twitch.
      </p>
      <ObsOutputControls />
    </section>
  </section>
</template>
