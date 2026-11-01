<script setup lang="ts">
import { useWorkflowNativeTools, type NativeToolsSubject } from '../../composables/coforge/use-workflow-native-tools';
const props = defineProps<{ subject?: NativeToolsSubject; prefix?: string }>();
const tools = useWorkflowNativeTools(props);
</script>
<template>
  <section v-if="tools.step" class="cf-idea-section" :aria-label="tools.label('Native workflow tools')" data-workflow-field="nativeTools">
    <h3>Native tools</h3>
    <p class="cf-settings-help">Claude Code and Codex can coordinate their own native assistants within this invocation. They share this attempt's scope, cancellation and finite limits. CoForge does not dispatch separate CoWorker runs.</p>
    <p v-if="tools.providerContextHelp" class="cf-settings-help">{{ tools.providerContextHelp }}</p>
    <p v-if="!tools.supported" class="cf-settings-help">Select native Claude Code, Codex or a supported saved CoWorker to configure these tools. Simulation, Herdr and external MCP clients retain their separate capabilities.</p>
    <label class="cf-workflow-check"><input v-model="tools.delegation" type="checkbox" :disabled="!tools.supported && !tools.delegation" :aria-label="tools.label('Allow provider-native assistants')" />Allow provider-native assistants</label>
    <label v-if="tools.delegation" class="cf-field"><span>Maximum concurrent assistants</span><input v-model.number="tools.concurrency" type="number" min="1" max="8" step="1" :aria-label="tools.label('Maximum concurrent native assistants')" /><small>Native children inherit the scoped tool broker. They cannot widen repository access or bypass final review. Background Codex delegation also requires an elapsed deadline.</small></label>
    <h4>Verification commands</h4>
    <p v-if="subject" class="cf-settings-help">Verification applies to code polishing only. Text polishing retains no repository access; enabled native assistants can perform analysis.</p>
    <p v-if="tools.access === 'none'" class="cf-settings-help">This step has no repository access. Select read-only project or isolated worktree access before configuring verification.</p>
    <p v-else-if="!tools.host?.enabled" class="cf-settings-help">Enable isolated workflow verification and save command definitions in Vault integrations first. Workflow imports cannot grant execution permission.</p>
    <template v-else>
      <p class="cf-settings-help">Commands run in a private Docker copy with the captured local image, timeout and invocation allowance. Select only the checks this step needs.</p>
      <label v-for="command in tools.host.commands" :key="command.id" class="cf-workflow-check"><input :checked="tools.selected.includes(command.id)" type="checkbox" :disabled="!tools.supported" :aria-label="tools.label(`Allow verification: ${command.label}`)" @change="tools.toggleCommand(command.id)" />{{ command.label }} · <code>{{ command.id }}</code></label>
    </template>
    <p v-if="tools.selected.length" class="cf-settings-help">Selected IDs: {{ tools.selected.join(', ') }}. <button type="button" class="cf-btn cf-btn-ghost" @click="tools.clearCommands()">Clear verification selections</button></p>
    <p v-if="tools.step.nativeTools" class="cf-workflow-policy" role="status">Save this workflow to apply these choices to future admissions. Existing attempts keep their captured capabilities. Review saved instructions that still forbid assistants or executed checks.</p>
  </section>
</template>
