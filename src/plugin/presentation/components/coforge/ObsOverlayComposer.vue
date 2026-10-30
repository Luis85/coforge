<script setup lang="ts">
import { useObsOverlays } from "../../composables/coforge/use-obs-overlays";
const model = useObsOverlays();
</script>
<template>
  <section
    class="cf-production-section"
    aria-label="Public OBS text overlay composer"
  >
    <header class="cf-production-heading">
      <div>
        <h2>Public text overlays</h2>
        <p>
          Send approved CoForge content into a supported OBS text source.
          Navigation and preview never publish.
        </p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || !model.connected || model.ui.pending"
        @click="model.inventory()"
      >
        Load public overlay choices
      </button>
    </header>
    <p v-if="!model.supported || !model.connected">
      Connect OBS and create a supported Text source in OBS. Then load public
      choices here.
    </p>
    <p v-if="model.ui.error" class="cf-inline-error" role="alert">
      {{ model.ui.error }}
    </p>
    <p v-if="model.ui.notice" role="status">{{ model.ui.notice }}</p>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Saved overlay mapping</span
        ><select v-model="model.ui.selection">
          <option value="">Choose a saved mapping</option>
          <option
            v-for="overlay in model.saved"
            :key="overlay.id"
            :value="overlay.id"
          >
            {{ overlay.name }}
          </option>
        </select></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.ui.selection || model.ui.dirty || model.ui.pending"
        @click="model.load()"
      >
        Load overlay mapping</button
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.ui.pending"
        @click="model.reset()"
      >
        Discard overlay draft
      </button>
    </div>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Overlay name</span
        ><input v-model="model.ui.name" maxlength="150" /></label
      ><label class="cf-field"
        ><span>Public project</span
        ><select v-model="model.ui.projectId">
          <option value="">Choose a public project</option>
          <option
            v-for="project in model.ui.choices.projects"
            :key="project.id"
            :value="project.id"
          >
            {{ project.name }}
          </option>
        </select></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.ui.projectId || model.ui.pending || !model.connected"
        @click="model.inventory()"
      >
        Load selected project content
      </button>
    </div>
    <p v-if="model.ui.kind === 'now-playing'" role="status">
      This saved overlay used the retired CoForge player. Clear or remove it;
      music playback now uses OBS media sources.
    </p>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Public content</span
        ><select v-model="model.ui.kind">
          <option value="request">Screened request</option>
          <option value="increment">Accepted increment</option>
          <option value="recognition">Community recognition</option>
          <option value="council-excerpt">Approved Council excerpt</option>
        </select></label
      ><label class="cf-field"
        ><span>OBS text source</span
        ><select v-model="model.ui.inputId">
          <option value="">Choose a supported text source</option>
          <option
            v-for="input in model.ui.choices.inputs"
            :key="input.id"
            :value="input.id"
          >
            {{ input.name }}
          </option>
        </select></label
      ><label v-if="model.needsSubject" class="cf-field"
        ><span>Public item</span
        ><select v-model="model.ui.subjectId">
          <option value="">Choose available public content</option>
          <option
            v-for="candidate in model.candidates"
            :key="candidate.id"
            :value="candidate.id"
          >
            {{ candidate.name }}
          </option>
        </select></label
      >
    </div>
    <label v-if="model.ui.kind === 'council-excerpt'" class="cf-field"
      ><span>Authored Council excerpt for public display</span
      ><textarea v-model="model.ui.excerpt" rows="4" maxlength="2000" /><small
        >Write only the excerpt you approve for viewers. Private task notes and
        Council contributions are never imported automatically.</small
      ></label
    >
    <label class="cf-project-repository-toggle"
      ><input v-model="model.ui.publicConfirmed" type="checkbox" /><span
        >I approve the selected content for public display</span
      ></label
    >
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="
        !model.supported ||
        !model.connected ||
        model.ui.pending ||
        !model.ui.publicConfirmed ||
        !model.ui.name.trim() ||
        !model.ui.projectId ||
        !model.ui.inputId ||
        (model.needsSubject && !model.ui.subjectId)
      "
      @click="model.preview()"
    >
      Preview public overlay text
    </button>
    <section
      v-if="model.ui.preview"
      class="cf-production-review"
      aria-label="Review outgoing public overlay"
    >
      <h3>Publish to {{ model.ui.preview.inputName }}</h3>
      <pre class="cf-overlay-outgoing">{{ model.ui.preview.text }}</pre>
      <p v-if="model.ui.preview.onAir">
        This source is currently on air. Publishing changes its text
        immediately.
      </p>
      <p v-if="model.ui.preview.shared">
        This text source is shared by multiple scene items. All uses receive the
        updated text.
      </p>
      <p v-if="model.ui.preview.switchesFromFile">
        Publishing switches this source from file-backed text to literal text.
      </p>
      <label class="cf-project-repository-toggle"
        ><input v-model="model.ui.reviewed" type="checkbox" /><span
          >Publish this captured text to {{ model.ui.preview.inputName }}</span
        ></label
      ><button
        type="button"
        class="cf-btn cf-btn-primary"
        :disabled="!model.ui.reviewed || model.ui.pending || !model.connected"
        @click="model.publish()"
      >
        Publish reviewed overlay
      </button>
    </section>
    <section
      v-if="model.saved.length"
      class="cf-production-section"
      aria-label="Saved public overlay mappings"
    >
      <h3>Approved overlay mappings</h3>
      <p>
        Refresh an approved mapping manually or add it to a saved show cue.
        Clearing only affects text still owned by CoForge; externally edited
        sources require inspection.
      </p>
      <p v-if="model.revocationNeeded" class="cf-inline-error" role="alert">
        An overlay needs revocation or its result is unconfirmed. OBS may retain
        the text while disconnected. Reconnect and clear the owned text
        explicitly; past broadcast video cannot be revoked.
      </p>
      <div
        v-for="overlay in model.saved"
        :key="overlay.id"
        class="cf-production-output-row"
      >
        <div>
          <strong>{{ overlay.name }}</strong
          ><span
            >{{ overlay.kind }} ·
            {{ overlay.publication?.status ?? "Not published" }}</span
          >
        </div>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.connected || model.ui.pending"
            @click="model.refresh(overlay.id)"
          >
            Refresh {{ overlay.name }}</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.connected || model.ui.pending"
            @click="model.clear(overlay.id)"
          >
            Clear {{ overlay.name }} text
          </button>
          <details>
            <summary>Remove {{ overlay.name }} mapping</summary>
            <p>Clear CoForge-owned text and remove this exact saved mapping.</p>
            <button
              type="button"
              class="cf-btn cf-btn-danger"
              :disabled="!model.connected || model.ui.pending"
              @click="model.remove(overlay.id)"
            >
              Clear owned text and remove {{ overlay.name }}
            </button>
          </details>
        </div>
      </div>
    </section>
  </section>
</template>
