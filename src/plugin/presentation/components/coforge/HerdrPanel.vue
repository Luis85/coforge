<script setup lang="ts">
import { useHerdr } from "../../composables/coforge/use-herdr";
const model = useHerdr();
</script>
<template>
  <details class="cf-herdr">
    <summary>Herdr agents</summary>
    <p>
      Send screened requests to an agent in the project's local directory. Herdr
      runs the agent; CoForge keeps its backlog and streamer review. A delivered
      prompt or idle agent is not proof of completed work.
    </p>
    <p v-if="model.store.example">
      Herdr example · synthetic workspaces and agents, no native commands or
      project changes.
    </p>
    <button
      v-if="model.store.example"
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.store.state.busy"
      title="Discard temporary workspaces, agents and example drafts"
      @click="model.exitExample()"
    >
      Exit example
    </button>
    <button
      v-if="!model.available && model.canPreview"
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="model.preview()"
    >
      Explore Herdr example
    </button>
    <div v-if="!model.available" class="cf-workflow-page-intro">
      <p>Herdr controls are available inside Obsidian.</p>
      <ol>
        <li>
          Install Herdr and your coding agent, then start a Herdr session.
        </li>
        <li>
          Open this project's Agent workflow in Obsidian and save the native
          executable and session.
        </li>
        <li>
          Refresh the connection, select a workspace and inspect the agent
          target before dispatch.
        </li>
      </ol>
    </div>
    <template v-else>
      <form class="cf-herdr-connection" @submit="model.configure">
        <label class="cf-field"
          ><span>Herdr executable</span
          ><input v-model="model.store.executable" required maxlength="1000"
        /></label>
        <label class="cf-field"
          ><span>Herdr session</span
          ><input v-model="model.store.session" required maxlength="80"
        /></label>
        <button
          type="submit"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.state.busy"
        >
          Save Herdr connection
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.state.busy"
          @click="model.refresh()"
        >
          Refresh Herdr
        </button>
      </form>
      <p v-if="!model.observation">
        Install Herdr and your coding agent, start the chosen Herdr session,
        then refresh. Use a native executable; Windows batch wrappers and WSL
        bridges are not supported.
      </p>
      <p v-else>
        {{
          model.observation.running
            ? model.observation.compatible
              ? "Connected"
              : "Incompatible CLI/server versions — update Herdr"
            : "Session is not running — start it in Herdr"
        }}
        · {{ model.observation.version }} ·
        {{ model.store.state.settings.session }}
      </p>
      <p v-if="model.store.state.checkedAt">
        Last checked
        {{ new Date(model.store.state.checkedAt).toLocaleTimeString() }}.
        Connected status refreshes every 10 seconds.
      </p>
      <section
        v-if="model.unknown.length"
        aria-label="Herdr actions need inspection"
      >
        <h3>Inspect unconfirmed actions</h3>
        <p>
          Refresh the original session and inspect its agents before
          acknowledging. These actions will not be retried automatically.
        </p>
        <ul>
          <li v-for="record in model.unknown" :key="record.id">
            {{ record.kind }} · {{ record.ideaId || record.projectId }} ·
            {{ record.session }} · {{ record.status
            }}<button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="model.store.state.busy"
              @click="model.acknowledge(record.id)"
            >
              I inspected this action in Herdr
            </button>
          </li>
        </ul>
      </section>
      <div v-if="model.connected" class="cf-herdr-workspace">
        <section aria-label="Herdr workspace controls">
          <h3>Workspaces and agents</h3>
          <p>
            {{ model.project?.settings.projectName || "Select a project" }} ·
            {{
              model.project?.projectPath ||
              "Set the project directory in project settings"
            }}
          </p>
          <label class="cf-field"
            ><span>Herdr workspace</span
            ><select
              v-model="model.store.workspace"
              aria-label="Herdr workspace"
              :disabled="model.store.state.busy"
            >
              <option value="">All workspaces</option>
              <option
                v-for="workspace in model.observation?.workspaces"
                :key="workspace.id"
                :value="workspace.id"
              >
                {{ workspace.name }} · {{ workspace.cwd }}
              </option>
            </select></label
          >
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              model.store.state.busy ||
              !model.project?.projectPath ||
              Boolean(model.unknown.length)
            "
            @click="model.createWorkspace()"
          >
            Create workspace for project
          </button>
          <label class="cf-field"
            ><span>Empty shell pane</span
            ><select
              v-model="model.store.pane"
              aria-label="Empty shell pane"
              :disabled="model.store.state.busy"
            >
              <option value="">Choose an empty shell</option>
              <option
                v-for="pane in model.panes"
                :key="pane.id"
                :value="pane.id"
              >
                {{ pane.id }} · {{ pane.cwd }}
              </option>
            </select></label
          >
          <label class="cf-field"
            ><span>Herdr agent provider</span
            ><select
              v-model="model.store.provider"
              aria-label="Herdr agent provider"
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
              <option value="cursor">Cursor</option>
              <option value="opencode">OpenCode</option>
            </select></label
          >
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              model.store.state.busy ||
              !model.store.pane ||
              !model.project ||
              Boolean(model.unknown.length)
            "
            @click="model.startAgent()"
          >
            Start Herdr agent
          </button>
          <label class="cf-field"
            ><span>Herdr agent</span
            ><select
              v-model="model.store.agent"
              aria-label="Herdr agent"
              :disabled="model.store.state.busy"
            >
              <option value="">Choose an agent</option>
              <option
                v-for="agent in model.agents"
                :key="agent.paneId"
                :value="agent.paneId"
              >
                {{ agent.name }} · {{ agent.status
                }}{{ agent.ready ? "" : " · not ready" }} · {{ agent.cwd }}
              </option>
            </select></label
          >
          <div class="cf-settings-actions">
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="model.store.state.busy || !model.store.agent"
              @click="model.focus()"
            >
              Focus agent in Herdr</button
            ><button
              type="button"
              class="cf-btn cf-btn-danger"
              :disabled="
                model.store.state.busy ||
                !model.store.agent ||
                Boolean(model.unknown.length)
              "
              @click="model.interrupt()"
            >
              Interrupt agent…
            </button>
          </div>
          <section
            v-if="model.store.interruptConfirm"
            aria-label="Confirm Herdr interrupt"
          >
            <p>
              Send Ctrl+C to {{ model.store.interruptConfirm.name }} ({{
                model.store.interruptConfirm.paneId
              }})? This may interrupt its current work.
            </p>
            <button
              type="button"
              class="cf-btn cf-btn-danger"
              :disabled="model.store.state.busy"
              @click="model.confirmInterrupt()"
            >
              Confirm agent interrupt</button
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.cancelInterrupt()"
            >
              Cancel interrupt
            </button>
          </section>
        </section>
        <section aria-label="Herdr request dispatch">
          <h3>Dispatch a request</h3>
          <label class="cf-field"
            ><span>Screened CoForge request</span
            ><select
              v-model="model.store.request"
              aria-label="Screened CoForge request"
              :disabled="model.store.state.busy"
            >
              <option value="">Choose a screened request</option>
              <option
                v-for="idea in model.requests"
                :key="idea.id"
                :value="idea.id"
              >
                {{ idea.id }} · {{ idea.title }}
              </option>
            </select></label
          >
          <p v-if="!model.requests.length">
            Screen an open request in this project before dispatching it.
          </p>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              model.store.state.busy ||
              !model.store.request ||
              !model.store.agent ||
              Boolean(model.unknown.length)
            "
            @click="model.review()"
          >
            Review Herdr dispatch
          </button>
          <section v-if="model.store.review" aria-label="Reviewed Herdr prompt">
            <h4>Review exact prompt and target</h4>
            <p>
              {{ model.store.review.ideaId }} →
              {{ model.store.review.target.name }} ·
              {{ model.store.review.target.paneId }} ·
              {{ model.store.review.projectPath }}
            </p>
            <pre tabindex="0">{{ model.store.review.prompt }}</pre>
            <button
              type="button"
              class="cf-btn cf-btn-primary"
              :disabled="
                model.store.state.busy || Boolean(model.unknown.length)
              "
              @click="model.send()"
            >
              Send reviewed request to Herdr
            </button>
          </section>
        </section>
      </div>
      <details v-if="model.store.state.records.length">
        <summary>Recent Herdr actions</summary>
        <ul>
          <li
            v-for="record in [...model.store.state.records].reverse()"
            :key="record.id"
          >
            {{ record.kind }} · {{ record.ideaId || record.projectId }} ·
            {{ record.status }} · {{ new Date(record.at).toLocaleString() }}
          </li>
        </ul>
      </details>
      <p
        v-if="model.store.error || model.store.state.error"
        class="cf-inline-error"
        role="alert"
      >
        {{ model.store.error || model.store.state.error }}
      </p>
      <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    </template>
  </details>
</template>
