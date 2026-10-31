<script setup lang="ts">
import { useWorkflowExecutionPolicy } from "../../composables/coforge/use-workflow-execution-policy";
const policy = useWorkflowExecutionPolicy();
</script>
<template>
  <section
    v-if="policy.visible"
    class="cf-idea-section"
    aria-label="Build execution settings"
    data-workflow-field="execution"
    tabindex="-1"
  >
    <h3>Build execution</h3>
    <label class="cf-field"
      ><span>Execution policy</span>
      <select v-model="policy.mode" aria-label="Build execution policy">
        <option value="foreground">
          Foreground · existing short-task limits
        </option>
        <option value="background" :disabled="!policy.eligible">
          Background Build · continues after Obsidian closes
        </option>
      </select>
    </label>
    <p v-if="policy.unsupported" class="cf-inline-error" role="alert">
      Background execution requires a code-change step with worktree access and
      native Claude Code or Codex. Review this policy and provider; no
      foreground fallback is used.
    </p>
    <p v-if="policy.unresolvedCoworker" class="cf-settings-help">
      The saved CoWorker is resolved when the run starts. Its captured provider
      must support background Builds.
    </p>
    <template v-if="policy.policy">
      <p class="cf-settings-help">
        The worker owns this Build after admission. Closing Obsidian detaches
        the view; reopening checks the original execution. Resource limits and
        final human review still apply.
      </p>
      <label class="cf-workflow-check"
        ><input
          v-model="policy.hasDeadline"
          type="checkbox"
          aria-label="Set an elapsed deadline"
        />Set an elapsed deadline</label
      >
      <label v-if="policy.hasDeadline" class="cf-field"
        ><span>Elapsed deadline · hours</span
        ><input
          v-model.number="policy.deadlineHours"
          type="number"
          min="0"
          step="any"
          required
          aria-label="Build deadline hours"
          data-workflow-field="execution.maxRuntimeSeconds"
        /><small
          >Includes elapsed wall time, sleep and disconnected periods. 100 hours
          is just over four days.</small
        ></label
      >
      <p v-else class="cf-settings-help">
        No elapsed deadline. The ordinary short-task timeout does not terminate
        this background Build.
      </p>
      <label class="cf-workflow-check"
        ><input
          v-model="policy.idleEnabled"
          type="checkbox"
          aria-label="Warn about inactivity"
        />Warn about inactivity</label
      >
      <label v-if="policy.idleEnabled" class="cf-field"
        ><span>Activity warning after · minutes</span
        ><input
          v-model.number="policy.idleMinutes"
          type="number"
          min="1"
          step="any"
          required
          aria-label="Build inactivity warning minutes"
          data-workflow-field="execution.idleWarningSeconds"
        /><small
          >This is an advisory warning. Heartbeat contact does not prove
          progress; silence does not stop the Build.</small
        ></label
      >
      <details class="cf-workflow-options">
        <summary>Build resource bounds</summary>
        <p class="cf-settings-help">
          Inherits this workflow's {{ policy.inheritedTurns }} turn/tool-call
          cap and USD{{ policy.inheritedBudget }} cap unless you explicitly
          override them.
        </p>
        <label class="cf-workflow-check"
          ><input
            v-model="policy.turnsEnabled"
            type="checkbox"
            aria-label="Override Build tool or turn cap"
          />Override the turn/tool-call cap for this Build</label
        >
        <label v-if="policy.turnsEnabled" class="cf-field"
          ><span>Build turn/tool-call cap</span
          ><input
            v-model.number="policy.turns"
            type="number"
            min="1"
            max="100000"
            step="1"
            required
            aria-label="Build tool or turn cap"
            data-workflow-field="execution.maxTurns"
        /></label>
        <label class="cf-workflow-check"
          ><input
            v-model="policy.budgetEnabled"
            type="checkbox"
            aria-label="Override Build USD cap"
          />Override the USD cap for this Build</label
        >
        <label v-if="policy.budgetEnabled" class="cf-field"
          ><span>Build USD cap</span
          ><input
            v-model.number="policy.budget"
            type="number"
            min="0.1"
            max="10000"
            step="0.01"
            required
            aria-label="Build USD cap"
            data-workflow-field="execution.maxBudgetUsd"
        /></label>
        <p
          v-if="policy.step?.provider === 'codex' || policy.unresolvedCoworker"
          class="cf-settings-help"
        >
          Codex does not enforce the USD spending cap. Its tool-call cap and
          reported token usage remain distinct from provider turns and billing.
        </p>
      </details>
    </template>
    <p v-if="policy.changed" class="cf-workflow-policy" role="status">
      Pending policy change for future runs. Existing attempts keep their
      captured policy, provider and CoWorker profile. Save the workflow to apply
      this draft; this does not resume a timed-out attempt or release a Stop
      hold.
    </p>
  </section>
</template>
