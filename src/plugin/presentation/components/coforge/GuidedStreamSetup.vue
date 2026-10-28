<script setup lang="ts">
import { useStreamSetup } from "../../composables/coforge/use-stream-setup";
import TwitchAuthorization from "./TwitchAuthorization.vue";
const props = defineProps<{ hideReopen?: boolean }>();
const model = useStreamSetup();
</script>
<template>
  <button
    v-if="!model.visible && !props.hideReopen"
    type="button"
    class="cf-btn cf-btn-secondary cf-setup-reopen"
    @click="model.open()"
  >
    Guided setup
  </button>
  <section
    v-else-if="model.visible"
    class="cf-setup-guide"
    aria-label="Guided stream setup"
  >
    <header>
      <div>
        <h2>Set up your stream</h2>
        <p>Connect OBS and Twitch, then check everything before going live.</p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-ghost"
        :disabled="model.working"
        @click="model.dismiss()"
      >
        Skip setup for now
      </button>
    </header>
    <p v-if="!model.obs.supported">
      This preview explains setup. Tool detection and account connection work
      inside Obsidian.
    </p>
    <ol class="cf-setup-steps" aria-label="Setup steps">
      <li v-for="(step, index) in model.progress.steps" :key="step.id">
        <button
          type="button"
          :aria-current="model.store.setupStep === index ? 'step' : undefined"
          @click="model.store.setupStep = index"
        >
          <span>{{ index + 1 }}. {{ step.title }}</span
          ><small>{{ step.ready ? "Ready" : "Needs attention" }}</small>
        </button>
      </li>
    </ol>
    <div class="cf-setup-step">
      <h3>{{ model.step.title }}</h3>
      <p role="status">{{ model.step.detail }}</p>
      <template v-if="model.step.id === 'tools'">
        <p>
          Install OBS Studio 28 or later. Twitch runs through your account; no
          Twitch desktop app is needed.
        </p>
        <a
          href="https://obsproject.com/download"
          target="_blank"
          rel="noopener noreferrer"
          >Download OBS Studio</a
        >
        <label class="cf-field"
          ><span>OBS executable (optional)</span
          ><input
            v-model="model.obs.draft.executable"
            aria-label="Setup OBS executable (optional)"
            maxlength="1000"
            placeholder="Auto-detect a standard installation"
        /></label>
        <p>
          For portable OBS, enter its full executable path. For remote OBS,
          enter its server address in the next step.
        </p>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.obs.supported || model.obs.busy || model.working"
          @click="model.obs.detect()"
        >
          Check installed OBS
        </button>
      </template>
      <template v-else-if="model.step.id === 'connection'">
        <ol>
          <li>
            In OBS, open Tools → WebSocket Server Settings and enable the server
            with authentication.
          </li>
          <li>
            Copy its server password below. The usual local address is
            ws://127.0.0.1:4455/.
          </li>
        </ol>
        <label class="cf-field"
          ><span>OBS WebSocket URL</span
          ><input
            v-model="model.obs.draft.endpoint"
            aria-label="Setup OBS WebSocket URL"
            type="url"
            maxlength="500"
        /></label>
        <label class="cf-field"
          ><span>OBS password</span
          ><input
            v-model="model.obs.password"
            aria-label="Setup OBS password"
            type="password"
            autocomplete="off"
            maxlength="1000"
        /></label>
        <p>
          {{
            model.obs.state.installation?.passwordSaved
              ? "A password is stored securely in Obsidian."
              : "Save the OBS password in Obsidian secret storage. It is never written to a project note."
          }}
        </p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              !model.obs.supported || model.obs.busy || !model.obs.password
            "
            @click="model.obs.savePassword()"
          >
            Store setup password
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.obs.supported || model.obs.busy"
            @click="model.obs.open()"
          >
            Launch and connect OBS
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="!model.obs.supported || model.obs.busy"
            @click="model.obs.connect()"
          >
            Verify OBS connection
          </button>
        </div>
        <a
          href="https://obsproject.com/kb/remote-control-guide"
          target="_blank"
          rel="noopener noreferrer"
          >OBS WebSocket setup help</a
        >
      </template>
      <template v-else-if="model.step.id === 'scenes'">
        <p>
          Create a gameplay scene in OBS. A separate break scene lets Pause keep
          the broadcast live.
        </p>
        <form @submit="model.obs.save">
          <label class="cf-field"
            ><span>Go-live scene</span
            ><select
              v-model="model.obs.draft.liveSceneId"
              aria-label="Setup go-live scene"
            >
              <option value="">Choose a connected OBS scene</option>
              <option
                v-for="scene in model.obs.scenes"
                :key="scene.id"
                :value="scene.id"
              >
                {{ scene.name }}
              </option>
            </select></label
          >
          <label class="cf-field"
            ><span>BRB scene</span
            ><select
              v-model="model.obs.draft.breakSceneId"
              aria-label="Setup BRB scene"
            >
              <option value="">No BRB scene</option>
              <option
                v-for="scene in model.obs.scenes"
                :key="scene.id"
                :value="scene.id"
              >
                {{ scene.name }}
              </option>
            </select></label
          >
          <div class="cf-settings-actions">
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.obs.connected || model.obs.busy"
              @click="model.obs.refresh()"
            >
              Reload available scenes</button
            ><button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="!model.obs.connected || model.obs.busy"
            >
              Save setup scenes
            </button>
          </div>
        </form>
      </template>
      <template v-else-if="model.step.id === 'twitch'">
        <p>
          Connect the channel owner. If you use a separate chatbot, authorize
          that account too.
        </p>
        <details>
          <summary>Get a Twitch Client ID</summary>
          <ol>
            <li>
              Verify your Twitch email and enable two-factor authentication.
            </li>
            <li>
              Open the developer console, register an application and choose the
              Public client type.
            </li>
            <li>
              If registration requires a redirect URL, add
              http://localhost:3000. Device authorization does not use a local
              callback.
            </li>
            <li>
              Copy its Client ID below. CoForge uses device authorization and
              does not ask for a client secret.
            </li>
          </ol>
          <a
            href="https://dev.twitch.tv/console/apps"
            target="_blank"
            rel="noopener noreferrer"
            >Open Twitch developer applications</a
          >
          ·
          <a
            href="https://dev.twitch.tv/docs/authentication/register-app/"
            target="_blank"
            rel="noopener noreferrer"
            >Registration instructions</a
          >
        </details>
        <label class="cf-field"
          ><span>Twitch Client ID</span
          ><input
            v-model="model.twitch.connection.twitchClientId"
            aria-label="Setup Twitch Client ID"
            maxlength="100"
        /></label>
        <label class="cf-project-repository-toggle"
          ><input
            v-model="model.twitch.connection.twitchBotUsesStreamer"
            type="checkbox"
          /><span>Use the streamer account as the chatbot</span></label
        >
        <TwitchAuthorization
          :client-id="model.twitch.connection.twitchClientId"
          :uses-streamer="model.twitch.connection.twitchBotUsesStreamer"
        />
        <label class="cf-project-repository-toggle"
          ><input
            v-model="model.twitch.connection.twitchEnabled"
            type="checkbox"
          /><span>Receive Twitch chat</span></label
        >
        <label class="cf-project-repository-toggle"
          ><input
            v-model="model.twitch.connection.twitchBotReplies"
            type="checkbox"
          /><span
            >Enable automatic chatbot replies and recurring messages</span
          ></label
        >
        <p>
          Automatic messages are optional and stay off until you enable them.
          Viewers use !register, !request, !bug and !vote.
        </p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="
              !model.twitch.supported ||
              model.twitch.checking ||
              Boolean(model.twitch.state.authorization)
            "
            @click="model.twitch.saveConnection()"
          >
            Save setup Twitch settings</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.twitch.supported || model.twitch.checking"
            @click="model.twitch.reconnect()"
          >
            Verify Twitch connection
          </button>
        </div>
        <p v-if="model.twitch.error" role="alert" class="cf-inline-error">
          {{ model.twitch.error }}
        </p>
        <p v-if="model.twitch.notice" role="status">
          {{ model.twitch.notice }}
        </p>
      </template>
      <template v-else>
        <ol>
          <li>
            In OBS Settings → Stream, connect the intended Twitch account and
            check the destination.
          </li>
          <li>
            Review OBS audio meters, sources, video and output settings. CoForge
            does not read your stream key.
          </li>
          <li>
            Optionally create a project to collect viewer requests. OBS
            streaming works independently.
          </li>
        </ol>
        <label class="cf-project-repository-toggle"
          ><input v-model="model.reviewed" type="checkbox" /><span
            >I reviewed the destination, audio and video in OBS</span
          ></label
        >
        <ul>
          <li
            v-for="step in model.progress.steps.filter((step) => !step.ready)"
            :key="step.id"
          >
            {{ step.title }}: {{ step.detail }}
          </li>
        </ul>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="!model.progress.ready || model.working"
          @click="model.finish()"
        >
          Finish setup
        </button>
        <p>
          Finishing does not start a broadcast. Use Prepare stream, review the
          result, then explicitly press Go live.
        </p>
      </template>
    </div>
    <p
      v-if="model.error || model.obs.error"
      role="alert"
      class="cf-inline-error"
    >
      {{ model.error || model.obs.error }}
    </p>
    <p v-if="model.obs.notice" role="status">{{ model.obs.notice }}</p>
    <footer>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.setupStep === 0"
        @click="model.back()"
      >
        Previous setup step
      </button>
      <span>Step {{ model.store.setupStep + 1 }} of 5</span
      ><button
        v-if="model.store.setupStep < 4"
        type="button"
        class="cf-btn cf-btn-primary"
        @click="model.next()"
      >
        Next setup step
      </button>
    </footer>
  </section>
</template>
