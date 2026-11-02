<script setup lang="ts">
import { useWorkflowNativeTools, type NativeToolsSubject } from '../../composables/coforge/use-workflow-native-tools';
const props = defineProps<{ subject?: NativeToolsSubject; prefix?: string; effectiveProvider?: string; providerResolved?: boolean }>();
const tools = useWorkflowNativeTools(props);
</script>
<template>
  <section v-if="tools.step" class="cf-idea-section" :aria-label="tools.label('Native workflow tools')" data-workflow-field="nativeTools">
    <h3>Agent tools</h3>
    <section v-if="tools.analytical" :aria-label="tools.label('Analytical agent tools')">
      <h4>Research and native assistants</h4>
      <p class="cf-settings-help">New native planning, design and Markdown tasks include these tools by default. Assistants inherit this step’s file access; these analytical tools do not allow shell commands or repository writes.</p>
      <label class="cf-workflow-check"><input v-model="tools.delegation" type="checkbox" :aria-label="tools.label('Allow provider-native assistants')" />Native assistants for analysis</label>
      <label class="cf-workflow-check"><input v-model="tools.research" type="checkbox" :aria-label="tools.label('Allow native web research')" />Native web research</label>
      <p class="cf-settings-help">Web research uses the provider’s supported search and fetch tools. Account and network availability still apply. Unchecking a tool saves an explicit preference for future attempts.</p>
      <details v-if="tools.delegation" class="cf-workflow-options">
        <summary>Optional assistant settings</summary>
        <label class="cf-field"><span>Maximum concurrent assistants</span><input v-model.number="tools.concurrency" type="number" min="1" max="8" step="1" :aria-label="tools.label('Maximum concurrent native assistants')" /><small>The default is 2 concurrent assistants. The native parent coordinates them within this step’s captured scope.</small></label>
      </details>
    </section>
    <section v-else-if="tools.coding" :aria-label="tools.label('Native worktree coding')">
      <h4>Normal native coding</h4>
      <p class="cf-settings-help">{{ tools.codingHelp }} New Build and code-polishing admissions capture this profile, including when they use an older saved workflow.</p>
      <p class="cf-settings-help">{{ tools.boundaryHelp }}</p>
      <section v-if="tools.instructionReview" :aria-label="tools.label('Build instructions need review')">
        <p v-if="tools.legacyStarter" class="cf-settings-help">This earlier starter still forbids commands and test execution even when coding tools are available. Review it before a future run. Updating replaces only the known starter in this draft and keeps your added instructions; Save workflow is still required. Existing runs keep their captured instructions.</p>
        <p v-else class="cf-settings-help">These saved instructions restrict commands or test execution even when coding tools are available. Your custom instructions are preserved. Review the text before a future run; tool availability does not override it.</p>
        <button type="button" class="cf-btn cf-btn-secondary" @click="tools.reviewInstructions()">Review step instructions</button>
        <button v-if="tools.legacyStarter" type="button" class="cf-btn cf-btn-secondary" @click="tools.updateStarter()">Update known starter in draft</button>
      </section>
      <details class="cf-workflow-options">
        <summary>Optional assistant settings</summary>
      <label class="cf-field"><span>Maximum concurrent assistants</span><input v-model.number="tools.codingConcurrency" type="number" min="1" max="8" step="1" :disabled="tools.codingCapacityFixed" :aria-label="tools.label('Maximum concurrent native assistants')" /><small>The default is 2. This limits permitted concurrency, not the total number of assistants over the attempt. You can stop the task at any time. Final review still applies.</small></label>
      <p v-if="tools.codingCapacityFixed" class="cf-settings-help">Code improvements still use the default of 2 concurrent native assistants. Re-enable text-only assistants to edit the shared limit; their explicit opt-out is kept until then.</p>
      </details>
      <p v-if="subject" class="cf-settings-help">Code polishing uses these coding tools. {{ tools.textPolishingHelp }}</p>
      <details v-if="tools.textAnalytical" class="cf-workflow-options" aria-label="Text-only improvement tools">
        <summary>Text-only improvement tools</summary>
        <p class="cf-settings-help">These choices apply to new text-only passes with restricted analysis access. Code improvements retain their normal coding tools and research. Saving preferences never starts a pass or changes an earlier attempt.</p>
        <label class="cf-workflow-check"><input v-model="tools.delegation" type="checkbox" :aria-label="tools.label('Allow provider-native assistants')" />Native assistants for text-only improvements</label>
        <label class="cf-workflow-check"><input v-model="tools.research" type="checkbox" :aria-label="tools.label('Allow native web research')" />Native web research for text-only improvements</label>
      </details>
      <p v-if="tools.selected.length" class="cf-settings-help">Earlier isolated command selections are retained in the saved definition. This coding profile uses normal project commands instead.</p>
    </section>
    <template v-else>
      <p class="cf-settings-help">Classifiers and other restricted tasks keep their existing tool permissions. Native assistants, when explicitly permitted, inherit that captured scope and cancellation.</p>
      <p v-if="!tools.supported" class="cf-settings-help">Select native Claude Code, Codex or a resolved supported CoWorker to configure native assistants. Simulation, Herdr and external MCP clients retain their own capabilities.</p>
      <label class="cf-workflow-check"><input v-model="tools.delegation" type="checkbox" :disabled="!tools.supported && !tools.delegation" :aria-label="tools.label('Allow provider-native assistants')" />Allow provider-native assistants</label>
      <label v-if="tools.delegation" class="cf-field"><span>Maximum concurrent assistants</span><input v-model.number="tools.concurrency" type="number" min="1" max="8" step="1" :aria-label="tools.label('Maximum concurrent native assistants')" /><small>These assistants inherit the restricted tool broker. CoForge follows the native parent session and its children until they finish or are stopped.</small></label>
      <template v-if="tools.unavailableResearch">
        <p class="cf-settings-help">The saved native research request is unavailable for this provider or result contract. Clear this preference to save the new choice; no research tools are granted here.</p>
        <label class="cf-workflow-check"><input v-model="tools.research" type="checkbox" :aria-label="tools.label('Allow native web research')" />Saved native research request</label>
      </template>
    </template>
      <details v-if="!tools.coding" class="cf-workflow-options">
        <summary>Advanced isolated verification</summary>
        <p class="cf-settings-help">Retained legacy and explicitly configured read-only checks can use the separate Docker verification profile. This is not the ordinary coding-worktree execution profile.</p>
        <p v-if="tools.access === 'none'" class="cf-settings-help">This step has no repository access. Verification requires read-only project access.</p>
        <p v-else-if="!tools.host?.enabled" class="cf-settings-help">An explicit isolated verification grant is not enabled in Vault integrations.</p>
        <template v-else>
          <p class="cf-settings-help">These selected checks use a private Docker source copy with the captured image, timeout and invocation allowance.</p>
          <label v-for="command in tools.host.commands" :key="command.id" class="cf-workflow-check"><input :checked="tools.selected.includes(command.id)" type="checkbox" :disabled="!tools.supported || tools.access === 'none'" :aria-label="tools.label(`Allow verification: ${command.label}`)" @change="tools.toggleCommand(command.id)" />{{ command.label }} · <code>{{ command.id }}</code></label>
        </template>
        <p v-if="tools.selected.length" class="cf-settings-help">Selected IDs: {{ tools.selected.join(', ') }}. <button type="button" class="cf-btn cf-btn-ghost" @click="tools.clearCommands()">Clear verification selections</button></p>
      </details>
    <p v-if="tools.providerContextHelp" class="cf-settings-help">{{ tools.providerContextHelp }}</p>
    <p class="cf-settings-help">MCP-driven coding tasks use their captured MCP worktree tools. The external client directs its own agents.</p>
    <p class="cf-workflow-policy" role="status">Save this workflow to apply choices to future admissions. Existing attempts keep their captured capabilities. Saved custom instructions remain unchanged; review instructions that prohibit the coding work you intend.</p>
  </section>
</template>
