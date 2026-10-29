<script setup lang="ts">
import { useCouncilEditorForm } from "../../composables/coforge/use-council-definitions";
import CouncilRoundEditor from "./CouncilRoundEditor.vue";
const model = useCouncilEditorForm();
</script>
<template>
  <template v-if="model.store.draft">
    <label class="cf-field"
      ><span>Definition name</span
      ><input
        v-model="model.store.draft.name"
        aria-label="Definition name"
        maxlength="100"
        required
    /></label>
    <label class="cf-check"
      ><input v-model="model.store.draft.enabled" type="checkbox" /> Available
      for new runs</label
    >
    <p class="cf-settings-help">
      Saving a definition never starts work. Current grants and provider
      isolation are checked before every invocation.
    </p>
    <template v-if="model.store.draft.schema === 'agent/v1'">
      <p class="cf-settings-help"><strong>Enforced action-tool policy: CoForge MCP only.</strong> Native Council invocations disable built-in tools and other MCP servers. Agents can read only the captured invocation and its bound inputs; approved nudges become tasks after their contribution is saved.</p>
      <label class="cf-field"
        ><span>Role</span
        ><input v-model="model.store.draft.role" maxlength="500"
      /></label>
      <label class="cf-field"
        ><span>Instructions</span
        ><textarea
          v-model="model.store.draft.instructions"
          aria-label="Agent instructions"
          rows="8"
          maxlength="16000"
        />
      </label>
      <div class="cf-council-fields">
        <label class="cf-field"
          ><span>Provider</span
          ><select v-model="model.store.draft.provider">
            <option value="demo">Simulation</option>
            <option value="claude">Claude Code</option>
            <option value="herdr" disabled>
              Herdr managed Claude · unavailable for Council execution
            </option>
          </select></label
        >
        <label class="cf-field"
          ><span>Model</span
          ><input v-model="model.store.draft.model" maxlength="100" required
        /></label>
      </div>
      <p class="cf-settings-help">
        Herdr cannot enforce the isolated invocation profile required for
        Council runs in this release. Existing Herdr selections are preserved;
        choose Claude Code or Simulation before execution.
      </p>
      <label class="cf-field"
        ><span>Default validated result contract</span
        ><select v-model="model.store.draft.outputDefault">
          <option :value="undefined">Markdown (legacy default)</option>
          <option value="markdown">Analytical Markdown</option>
          <option value="plan">Validated implementation plan</option>
        </select></label
      >
      <label class="cf-field"
        ><span>Connection profile reference</span
        ><select v-model="model.store.draft.connectionProfile">
          <option :value="undefined">
            Inherit existing provider connection
          </option>
          <option
            v-for="profile in model.connectionProfiles"
            :key="profile.id"
            :value="profile.id"
          >
            {{ profile.label }}
          </option>
          <option
            v-if="model.profileIssue"
            :value="model.store.draft.connectionProfile"
            disabled
          >
            {{ model.store.draft.connectionProfile }} · unresolved saved
            reference
          </option>
        </select></label
      >
      <p v-if="model.profileIssue" class="cf-inline-error" role="status">
        {{ model.profileIssue }} Disabled imports retain unresolved references
        for repair.
      </p>
      <p class="cf-settings-help">
        Local Claude Code uses the executable and sign-in already configured in
        CoForge. Simulation has no external connection. These references do not
        store credentials or grant tools.
      </p>
      <label class="cf-field"
        ><span>Selected context sources, one per line</span
        ><textarea
          :value="model.store.draft.contextSources.join('\n')"
          rows="3"
          @input="model.setLines('contextSources', $event)"
        />
      </label>
      <label class="cf-field"
        ><span>Requested project access</span
        ><select v-model="model.store.draft.requestedCapabilities.project">
          <option value="none">No project tools</option>
          <option value="read">Read access, subject to host grants</option>
        </select></label
      >
      <label class="cf-check"
        ><input
          v-model="model.store.draft.requestedCapabilities.messaging"
          type="checkbox"
        />
        Request permission to propose messages</label
      >
    </template>
    <template v-else>
      <p class="cf-settings-help">
        Project <code>{{ model.store.draft.projectId }}</code>
      </p>
      <label v-if="model.store.draft.schema === 'council/v1'" class="cf-field"
        ><span>Owning team</span
        ><select v-model="model.store.draft.teamId">
          <option
            v-for="entry in model.teams"
            :key="entry.definition.id"
            :value="entry.definition.id"
          >
            {{ entry.definition.name }}
          </option>
        </select></label
      >
      <fieldset>
        <legend>Members in configured order</legend>
        <p v-if="!model.memberOptions.length" class="cf-settings-help">
          Create and save agents, then add them to this project's team.
        </p>
        <label
          v-for="entry in model.memberOptions"
          :key="entry.definition.id"
          class="cf-check"
          ><input
            type="checkbox"
            :checked="model.store.draft.members.includes(entry.definition.id)"
            @change="
              model.toggleMember(
                entry.definition.id,
                !model.store.draft.members.includes(entry.definition.id),
              )
            "
          />{{ entry.definition.name }}</label
        >
        <ol class="cf-council-order">
          <li v-for="(id, index) in model.store.draft.members" :key="id">
            <span>{{ model.membership(id) }}</span
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :aria-label="`Move ${model.membership(id)} earlier`"
              :disabled="index === 0"
              @click="model.move(model.store.draft.members, index, -1)"
            >
              Earlier</button
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :aria-label="`Move ${model.membership(id)} later`"
              :disabled="index === model.store.draft.members.length - 1"
              @click="model.move(model.store.draft.members, index, 1)"
            >
              Later
            </button>
          </li>
        </ol>
      </fieldset>
      <template v-if="model.store.draft.schema === 'team/v1'">
        <label class="cf-field"
          ><span>Pinned context sources, one per line</span
          ><textarea
            :value="model.store.draft.pinnedContext.join('\n')"
            rows="3"
            @input="model.setLines('pinnedContext', $event)"
          />
        </label>
        <label class="cf-field"
          ><span>Recent informational messages</span
          ><input
            v-model.number="model.store.draft.recentMessages"
            type="number"
            min="0"
            max="100"
        /></label>
        <label class="cf-field"
          ><span>Allowed message recipient IDs, one per line</span
          ><textarea
            :value="model.store.draft.allowedRecipients.join('\n')"
            rows="3"
            @input="model.setLines('allowedRecipients', $event)"
          />
        </label>
      </template>
      <template v-else>
        <CouncilRoundEditor />
        <details>
          <summary>Execution limits</summary>
          <div class="cf-council-fields">
            <label class="cf-field"
              ><span>Maximum invocations</span
              ><input
                v-model.number="model.store.draft.limits.maxInvocations"
                type="number"
                min="1"
                max="100"
            /></label>
            <label class="cf-field"
              ><span>Execution seconds</span
              ><input
                v-model.number="model.store.draft.limits.maxExecutionSeconds"
                type="number"
                min="15"
                max="7200"
            /></label>
            <label class="cf-field"
              ><span>Context characters</span
              ><input
                v-model.number="model.store.draft.limits.maxContextCharacters"
                type="number"
                min="1000"
                max="200000"
            /></label>
            <label class="cf-field"
              ><span>Artifact characters</span
              ><input
                v-model.number="model.store.draft.limits.maxArtifactCharacters"
                type="number"
                min="100"
                max="16000"
            /></label>
            <label class="cf-field"
              ><span>Generated messages</span
              ><input
                v-model.number="model.store.draft.limits.maxGeneratedMessages"
                type="number"
                min="0"
                max="100"
            /></label>
            <label class="cf-field"
              ><span>Descendant runs</span
              ><input
                v-model.number="model.store.draft.limits.maxDescendantRuns"
                type="number"
                min="0"
                max="100"
            /></label>
            <label class="cf-field"
              ><span>Delegation depth</span
              ><input
                v-model.number="model.store.draft.limits.maxDelegationDepth"
                type="number"
                min="0"
                max="10"
            /></label>
          </div>
        </details>
      </template>
    </template>
    <details>
      <summary>Stable definition reference</summary>
      <code>{{ model.store.draft.id }}</code>
    </details>
  </template>
</template>
