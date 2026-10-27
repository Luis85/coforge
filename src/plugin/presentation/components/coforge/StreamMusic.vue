<script setup lang="ts">
import { useMusic } from "../../composables/coforge/use-music";
const model = useMusic();
</script>
<template>
  <details class="cf-music">
    <summary>Stream music</summary>
    <p>
      Play MP3 files through Obsidian. In OBS, capture Obsidian's application
      audio or desktop audio output. Check the OBS audio meter before going
      live.
    </p>
    <p>
      Keep license, origin and attribution in a Markdown note next to each MP3.
      Review permission for streaming; a saved license label does not verify
      rights.
    </p>
    <p v-if="model.store.example">
      Music example · synthetic library and playback state, no audio or vault
      writes.
    </p>
    <button
      v-if="!model.available && model.canPreview"
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="model.preview()"
    >
      Explore music example
    </button>
    <p v-if="!model.available">
      Add your music and manage playlists inside Obsidian.
    </p>
    <template v-else>
      <p v-if="model.preparedPlaylist">Prepared for the stream: {{ model.preparedPlaylist.name }} <button type="button" class="cf-btn" :disabled="model.store.state.busy" @click="model.playPrepared">Play prepared playlist</button></p>
      <section aria-label="Music playback" class="cf-music-playback">
        <h3>{{ model.current?.title ?? "No track selected" }}</h3>
        <p>
          {{ model.playback.playlist || "Choose a saved playlist below" }} ·
          {{ model.playback.phase }}
        </p>
        <p v-if="model.current?.artist">{{ model.current.artist }}</p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.busy || model.playback.index === 0"
            @click="model.skip(-1)"
          >
            Previous track
          </button>
          <button
            v-if="model.playback.phase === 'playing'"
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="model.busy"
            @click="model.pause()"
          >
            Pause music
          </button>
          <button
            v-else-if="model.playback.phase === 'paused'"
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="model.busy"
            @click="model.resume()"
          >
            Resume music
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.playback.queue.length"
            @click="model.stop()"
          >
            Stop music
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              model.busy ||
              model.playback.index + 1 >= model.playback.queue.length
            "
            @click="model.skip(1)"
          >
            Next track
          </button>
        </div>
        <div class="cf-music-sliders">
          <label class="cf-field"
            ><span
              >Track position · {{ model.time(model.playback.position) }} /
              {{ model.time(model.playback.duration) }}</span
            ><input
              aria-label="Track position"
              type="range"
              min="0"
              :max="model.playback.duration || 1"
              step="1"
              :value="model.playback.position"
              :disabled="
                model.busy ||
                !['playing', 'paused'].includes(model.playback.phase) ||
                !model.playback.duration
              "
              @change="model.seek"
          /></label>
          <label class="cf-field"
            ><span
              >Music volume ·
              {{ Math.round(model.playback.volume * 100) }}%</span
            ><input
              aria-label="Music volume"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="model.playback.volume * 100"
              :disabled="model.busy"
              @change="model.volume"
          /></label>
        </div>
      </section>
      <details class="cf-music-library" open>
        <summary>Library and playlists</summary>
        <form class="cf-music-folder" @submit="model.configure">
          <label class="cf-field"
            ><span>Music folder in vault</span
            ><input v-model="model.store.folder" required maxlength="300"
          /></label>
          <button
            type="submit"
            class="cf-btn cf-btn-secondary"
            :disabled="model.busy"
          >
            Save music folder
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.busy"
            @click="model.refresh()"
          >
            Refresh music library
          </button>
        </form>
        <p v-if="model.store.state.library.warnings" role="alert">
          {{ model.store.state.library.warnings }} music or playlist notes could
          not be read. Review their frontmatter and refresh.
        </p>
        <div class="cf-music-workspace">
          <section aria-label="Saved music library">
            <h3>Music library</h3>
            <label class="cf-field"
              ><span>Find music</span
              ><input v-model="model.store.search" type="search"
            /></label>
            <p v-if="!model.store.state.library.tracks.length">
              Save MP3 files in {{ model.store.state.library.folder }}, then
              refresh. Create a metadata note to record each track's license and
              origin.
            </p>
            <p v-else-if="!model.library.length">
              No tracks match your search.
            </p>
            <ul class="cf-music-list" aria-label="Music tracks">
              <li v-for="track in model.library" :key="track.id">
                <strong>{{ track.title }}</strong
                ><span v-if="track.artist">{{ track.artist }}</span
                ><span>{{ track.license || "License not recorded" }}</span>
                <details>
                  <summary>License and origin</summary>
                  <p>License: {{ track.license || "Not recorded" }}</p>
                  <p>Origin: {{ track.origin || "Not recorded" }}</p>
                  <p>Attribution: {{ track.attribution || "Not recorded" }}</p>
                  <p>{{ track.id }}</p>
                </details>
                <div class="cf-settings-actions">
                  <button
                    type="button"
                    class="cf-btn cf-btn-secondary"
                    :aria-label="`Add to playlist: ${track.title}`"
                    :disabled="model.busy || model.store.tracks.length >= 500"
                    @click="model.add(track)"
                  >
                    Add to playlist</button
                  ><button
                    type="button"
                    class="cf-btn cf-btn-ghost"
                    :aria-label="`${track.note ? 'Open' : 'Create'} metadata note for ${track.title}`"
                    :disabled="model.busy"
                    @click="model.metadata(track)"
                  >
                    {{
                      track.note ? "Open metadata note" : "Create metadata note"
                    }}
                  </button>
                </div>
              </li>
            </ul>
          </section>
          <section aria-label="Music playlist editor">
            <h3>Playlist</h3>
            <label class="cf-field"
              ><span>Saved playlist</span
              ><select
                v-model="model.store.selected"
                aria-label="Saved playlist"
                :disabled="model.busy"
                @change="model.choose()"
              >
                <option value="">New playlist</option>
                <option
                  v-for="playlist in model.store.state.library.playlists"
                  :key="playlist.id"
                  :value="playlist.id"
                >
                  {{ playlist.name }}
                </option>
              </select></label
            >
            <form @submit="model.save">
              <label class="cf-field"
                ><span>Playlist name</span
                ><input v-model="model.store.name" maxlength="100" required
              /></label>
              <p v-if="!model.store.tracks.length">
                Add tracks from the library. Playback uses the last saved order.
              </p>
              <p v-if="model.missing" role="alert">
                {{ model.missing }} playlist files are missing. Restore or
                remove them before playback.
              </p>
              <ol class="cf-music-list" aria-label="Playlist track order">
                <li
                  v-for="(id, index) in model.store.tracks"
                  :key="`${index}-${id}`"
                >
                  <strong>{{ model.title(id) }}</strong>
                  <div class="cf-settings-actions">
                    <button
                      type="button"
                      class="cf-btn cf-btn-ghost"
                      :aria-label="`Move playlist track ${index + 1} up`"
                      :disabled="model.busy || index === 0"
                      @click="model.move(index, -1)"
                    >
                      Up</button
                    ><button
                      type="button"
                      class="cf-btn cf-btn-ghost"
                      :aria-label="`Move playlist track ${index + 1} down`"
                      :disabled="
                        model.busy || index + 1 === model.store.tracks.length
                      "
                      @click="model.move(index, 1)"
                    >
                      Down</button
                    ><button
                      type="button"
                      class="cf-btn cf-btn-ghost"
                      :aria-label="`Remove playlist track ${index + 1}`"
                      :disabled="model.busy"
                      @click="model.remove(index)"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              </ol>
              <div class="cf-settings-actions">
                <button
                  type="submit"
                  class="cf-btn cf-btn-secondary"
                  :disabled="model.busy || !model.store.name.trim()"
                >
                  Save playlist</button
                ><button
                  type="button"
                  class="cf-btn cf-btn-primary"
                  :disabled="model.busy || !model.store.selected"
                  @click="model.play()"
                >
                  Play saved playlist
                </button>
              </div>
            </form>
          </section>
        </div>
      </details>
      <p
        v-if="model.store.error || model.store.state.error"
        role="alert"
        class="cf-inline-error"
      >
        {{ model.store.error || model.store.state.error }}
      </p>
      <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    </template>
  </details>
</template>
