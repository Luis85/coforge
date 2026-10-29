<script setup lang="ts">
import { useCouncilModel } from "../../composables/coforge/use-council";
const model = useCouncilModel();
</script>
<template>
  <section
    v-if="model.selectedRun"
    aria-label="Run export and recovery"
    class="cf-council-section"
  >
    <details>
      <summary>Extend an exhausted execution allowance</summary>
      <p>
        Effective run allowance:
        {{ model.allowanceLimits(model.selectedRun).maxInvocations }} dispatches
        and
        {{
          model.allowanceLimits(model.selectedRun).executionLimitMs / 60000
        }}
        minutes of active execution. Existing consumed or reserved allowance
        remains counted. Queue, pauses and human waits do not consume active
        allowance.
      </p>
      <div class="cf-council-fields">
        <label class="cf-field"
          ><span>Additional dispatches</span
          ><input
            v-model.number="model.store.allowanceCalls"
            type="number"
            min="0"
            max="100"
            step="1" /></label
        ><label class="cf-field"
          ><span>Additional active minutes</span
          ><input
            v-model.number="model.store.allowanceMinutes"
            type="number"
            min="0"
            max="120"
            step="1"
        /></label>
      </div>
      <label class="cf-field"
        ><span>Child scope for the time extension</span
        ><select v-model="model.store.allowanceScope">
          <option value="">Run/root only; retain stricter child limits</option>
          <option
            v-for="scope in model.allowanceLimits(model.selectedRun)
              .scopeLimits"
            :key="scope.id"
            :value="scope.id"
          >
            {{ scope.id }}
          </option>
        </select></label
      ><label class="cf-field"
        ><span>Reason for the explicit extension</span
        ><textarea v-model="model.store.allowanceReason" maxlength="2000" />
      </label>
      <p>
        The host enforces finite total limits of 100 dispatches and 120 active
        minutes. This records a policy change while retaining the captured
        inputs, tools, permissions and unknown-outcome evidence. It does not
        start another action.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          model.store.busy ||
          !model.store.allowanceReason.trim() ||
          (!model.store.allowanceCalls && !model.store.allowanceMinutes)
        "
        @click="model.extendAllowance(model.selectedRun.id)"
      >
        Record allowance extension
      </button>
    </details>
    <details>
      <summary>Export or reassign retained results</summary>
      <p>
        Export contains private notes, prompts, attributed results and attempts.
        Review it before sharing.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.exportRun(model.selectedRun.id)"
      >
        Prepare private run export
      </button>
      <label v-if="model.store.exportedRun" class="cf-field"
        ><span>Private run JSON</span
        ><textarea
          :value="model.store.exportedRun"
          rows="8"
          readonly
          spellcheck="false"
        />
      </label>
      <label class="cf-field"
        ><span>Existing private note for recovered results</span
        ><input
          v-model="model.store.reassignPath"
          placeholder="CoForge/Recovery/Recovered discussion.md"
      /></label>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || model.settling || !model.store.reassignPath"
        @click="model.reassign(model.selectedRun.id)"
      >
        Publish retained results to selected note
      </button>
      <p>
        Choose an existing note. Recovery preserves human text and the captured
        input; it makes no provider call.
      </p>
      <template
        v-if="
          model.selectedRun.state === 'completed' ||
          model.selectedRun.state === 'cancelled'
        "
      >
        <label
          ><input v-model="model.store.pruneConsent" type="checkbox" /> I saved
          the private export and want to remove readable history for run
          {{ model.selectedRun.id }}.</label
        >
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="
            model.store.busy ||
            !model.store.pruneConsent ||
            !model.store.exportedRun
          "
          @click="model.pruneRun(model.selectedRun.id)"
        >
          Remove settled history
        </button>
        <p>
          Uncertain attempts and pending publications or deliveries block
          removal. Submission tombstones remain to prevent replay.
        </p>
      </template>
    </details>
    <details
      v-if="
        model.selectedRun.state === 'completed' &&
        model.selectedRun.artifacts.some((artifact) => artifact.plan)
      "
    >
      <summary>Continue a validated plan in the project workflow</summary>
      <p>
        Select a typed plan and an existing request. This explicit handoff
        starts that request's saved workflow with the selected plan as an input.
        Generic discussion prose cannot become a plan, and this action cannot
        accept code or publish the discussion.
      </p>
      <label class="cf-field"
        ><span>Validated plan artifact</span
        ><select v-model="model.store.handoffArtifactId">
          <option value="">Select plan</option>
          <option
            v-for="artifact in model.selectedRun.artifacts.filter(
              (item) => item.plan && !item.skipped,
            )"
            :key="artifact.id"
            :value="artifact.id"
          >
            {{ artifact.plan?.summary }}
          </option>
        </select></label
      >
      <label class="cf-field"
        ><span>Existing project request</span
        ><select v-model="model.store.handoffIdeaId">
          <option value="">Select request</option>
          <option
            v-for="idea in model.handoffIdeas"
            :key="idea.id"
            :value="idea.id"
          >
            {{ idea.id }} · {{ idea.title }}
          </option>
        </select></label
      >
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        :disabled="
          model.store.busy ||
          !model.store.handoffArtifactId ||
          !model.store.handoffIdeaId
        "
        @click="model.handoffPlan(model.selectedRun.id)"
      >
        Hand selected plan to project workflow
      </button>
    </details>
  </section>
</template>
