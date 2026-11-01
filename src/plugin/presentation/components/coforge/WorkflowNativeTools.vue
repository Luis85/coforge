<script setup lang="ts">
import { useWorkflowNativeTools, type NativeToolsSubject } from '../../composables/coforge/use-workflow-native-tools';
const props = defineProps<{ subject?: NativeToolsSubject; prefix?: string; effectiveProvider?: string; providerResolved?: boolean }>();
const tools = useWorkflowNativeTools(props);
</script>
<template>
  <section v-if="tools.step" class="cf-idea-section" :aria-label="tools.label('Native workflow tools')" data-workflow-field="nativeTools">
    <h3>Coding and native tools</h3>
    <section v-if="tools.coding" :aria-label="tools.label('Native worktree coding')">
      <h4>Normal native coding</h4>
      <p class="cf-settings-help">{{ tools.codingHelp }} New Build and code-polishing admissions capture this profile, including when they use an older saved workflow.</p>
      <p class="cf-settings-help">{{ tools.boundaryHelp }}</p>
      <label class="cf-field"><span>Maximum concurrent assistants</span><input v-model.number="tools.codingConcurrency" type="number" min="1" max="8" step="1" :aria-label="tools.label('Maximum concurrent native assistants')" /><small>The default is 2. This limits permitted concurrency, not the total number of assistants over the attempt. Existing deadlines and final review still apply.</small></label>
      <p v-if="subject" class="cf-settings-help">Code polishing uses these coding tools. Text-only polishing retains restricted analysis access; a saved assistant limit also permits assistants for those text-only passes.</p>
      <p v-if="tools.selected.length" class="cf-settings-help">Earlier isolated command selections are retained in the saved definition. This coding profile uses normal project commands instead.</p>
    </section>
    <template v-else>
      <p class="cf-settings-help">Classification and read-only analysis retain restricted tools. Native assistants, when permitted, share that captured scope and the attempt’s cancellation and limits.</p>
      <p v-if="!tools.supported" class="cf-settings-help">Select native Claude Code, Codex or a resolved supported CoWorker to configure native assistants. Simulation, Herdr and external MCP clients retain their own capabilities.</p>
      <label class="cf-workflow-check"><input v-model="tools.delegation" type="checkbox" :disabled="!tools.supported && !tools.delegation" :aria-label="tools.label('Allow provider-native assistants')" />Allow provider-native assistants</label>
      <label v-if="tools.delegation" class="cf-field"><span>Maximum concurrent assistants</span><input v-model.number="tools.concurrency" type="number" min="1" max="8" step="1" :aria-label="tools.label('Maximum concurrent native assistants')" /><small>These assistants inherit the restricted tool broker. Explicit background Codex delegation requires its captured elapsed deadline.</small></label>
      <details class="cf-workflow-options">
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
    </template>
    <p v-if="tools.providerContextHelp" class="cf-settings-help">{{ tools.providerContextHelp }}</p>
    <p class="cf-settings-help">MCP-driven coding tasks use their captured MCP worktree tools. The external client directs its own agents.</p>
    <p class="cf-workflow-policy" role="status">Save this workflow to apply choices to future admissions. Existing attempts keep their captured capabilities. Saved custom instructions remain unchanged; review instructions that prohibit the coding work you intend.</p>
  </section>
</template>
