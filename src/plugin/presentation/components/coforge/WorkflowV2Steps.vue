<script setup lang="ts">
import { useWorkflowV2EditorForm } from "../../composables/coforge/use-workflow-v2-editor";
const model = useWorkflowV2EditorForm();
</script>
<template>
  <section v-if="model.store.draft" aria-label="Proposal workflow steps">
    <div class="cf-settings-actions">
      <h3>Ordered steps</h3>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.addStep()"
      >
        Add proposal step
      </button>
    </div>
    <div
      v-for="(step, index) in model.store.draft.steps"
      :key="step.id"
      class="cf-council-round"
    >
      <div class="cf-settings-actions">
        <h4>{{ index + 1 }}. {{ step.name }}</h4>
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="index === 0"
          :aria-label="`Move ${step.name} earlier`"
          @click="model.move(model.store.draft.steps, index, -1)"
        >
          Earlier</button
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="index === model.store.draft.steps.length - 1"
          :aria-label="`Move ${step.name} later`"
          @click="model.move(model.store.draft.steps, index, 1)"
        >
          Later</button
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.duplicateStep(index)"
        >
          Duplicate step</button
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="model.store.draft.steps.length === 1"
          @click="model.store.draft.steps.splice(index, 1)"
        >
          Remove step
        </button>
      </div>
      <label class="cf-field"
        ><span>Step name</span
        ><input v-model="step.name" maxlength="100" required /></label
      ><label class="cf-field"
        ><span>Step kind</span
        ><select
          :value="step.kind"
          @change="model.replaceStep(model.store.draft, index, $event)"
        >
          <option value="agent">Reusable agent</option>
          <option value="council">Council discussion</option>
          <option value="approval">Human approval</option>
          <option value="checklist">Human checklist</option>
          <option value="message">Team message or directed request</option>
        </select></label
      ><label class="cf-field"
        ><span>Step instructions</span
        ><textarea v-model="step.instructions" rows="4" maxlength="16000" />
      </label>
      <label v-if="step.kind === 'agent'" class="cf-field"
        ><span>Validated result contract</span
        ><select v-model="step.output">
          <option value="markdown">Analytical Markdown</option>
          <option value="plan">Validated implementation plan</option>
        </select></label
      >
      <label v-if="step.kind === 'agent'" class="cf-field"
        ><span>Reusable agent</span
        ><select v-model="step.agentId">
          <option value="">Select agent</option>
          <option
            v-for="agent in model.agents"
            :key="agent.definition.id"
            :value="agent.definition.id"
          >
            {{ agent.definition.name }}
          </option>
        </select></label
      ><label v-if="step.kind === 'council'" class="cf-field"
        ><span>Reusable council</span
        ><select v-model="step.councilId">
          <option value="">Select council</option>
          <option
            v-for="council in model.councils"
            :key="council.definition.id"
            :value="council.definition.id"
          >
            {{ council.definition.name }}
          </option>
        </select></label
      >
      <template v-if="step.kind === 'message'"
        ><label class="cf-field"
          ><span>Message purpose</span
          ><select v-model="step.purpose">
            <option value="information">Information, no new task</option>
            <option value="request">Directed work request</option>
          </select></label
        ><label class="cf-field"
          ><span>Logical recipient ID</span
          ><input v-model="step.recipientId" maxlength="80" required /></label
        ><label class="cf-field"
          ><span>Message body</span
          ><textarea
            v-model="step.body"
            aria-label="Message body"
            rows="5"
            maxlength="16000"
            required
          />
        </label>
        <p class="cf-settings-help">
          The host validates the recipient against the team's allowed
          destinations and inherited root limits. Literal text may include
          <span v-for="token in model.messageTokens" :key="token"
            ><code>{{ token }}</code>
          </span>
          placeholders; credentials, capabilities and completion authority
          cannot be granted by a message.
        </p></template
      >
      <template
        v-if="
          step.kind === 'agent' ||
          step.kind === 'council' ||
          step.kind === 'message'
        "
        ><p class="cf-settings-help">
          Source and captured team context are included. Select explicit earlier
          results below; analytical steps have no project tools.
        </p>
        <fieldset>
          <legend>Explicit input bindings</legend>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="step.inputs.push({ kind: 'producer', stepId: '' })"
          >
            Add input binding
          </button>
          <div
            v-for="(binding, bindingIndex) in step.inputs"
            :key="bindingIndex"
            class="cf-council-round"
          >
            <label class="cf-field"
              ><span>Binding kind</span
              ><select
                :value="binding.kind"
                @change="model.changeBinding(step, bindingIndex, $event)"
              >
                <option value="producer">
                  All results from one earlier step
                </option>
                <option value="collection">Named ordered collection</option>
                <option value="artifact">One exact artifact</option>
              </select></label
            ><label v-if="binding.kind === 'producer'" class="cf-field"
              ><span>Producing step</span
              ><select v-model="binding.stepId">
                <option value="">Select earlier step</option>
                <template
                  v-for="earlier in model.store.draft.steps.slice(0, index)"
                  :key="earlier.id"
                  ><option
                    v-if="
                      earlier.kind === 'agent' || earlier.kind === 'council'
                    "
                    :value="earlier.id"
                  >
                    {{ earlier.name }}
                  </option></template
                >
              </select></label
            ><label v-if="binding.kind === 'collection'" class="cf-field"
              ><span>Input collection</span
              ><select v-model="binding.collectionId">
                <option value="">Select collection</option>
                <option
                  v-for="collection in model.store.draft.collections"
                  :key="collection.id"
                  :value="collection.id"
                >
                  {{ collection.id }}
                </option>
              </select></label
            ><template v-if="binding.kind === 'artifact'"
              ><label class="cf-field"
                ><span>Artifact producing step</span
                ><select v-model="binding.producerStepId">
                  <option value="">Select earlier step</option>
                  <template
                    v-for="earlier in model.store.draft.steps.slice(0, index)"
                    :key="earlier.id"
                    ><option
                      v-if="
                        earlier.kind === 'agent' || earlier.kind === 'council'
                      "
                      :value="earlier.id"
                    >
                      {{ earlier.name }}
                    </option></template
                  >
                </select></label
              ><label class="cf-field"
                ><span>Exact artifact ID</span
                ><input
                  v-model="binding.artifactId"
                  maxlength="200"
                  required /></label></template
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              @click="step.inputs.splice(bindingIndex, 1)"
            >
              Remove binding
            </button>
          </div>
        </fieldset></template
      >
      <fieldset v-if="step.kind === 'checklist'">
        <legend>Human checklist</legend>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.addChecklistItem(step)"
        >
          Add checklist item
        </button>
        <div v-for="(item, itemIndex) in step.items" :key="item.id">
          <label class="cf-field"
            ><span>Checklist item</span
            ><input v-model="item.label" maxlength="500" required /></label
          ><label class="cf-check"
            ><input v-model="item.required" type="checkbox" />Required before
            continuing</label
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="step.items.length === 1"
            @click="step.items.splice(itemIndex, 1)"
          >
            Remove item
          </button>
        </div>
      </fieldset>
      <details>
        <summary>Stable step reference</summary>
        <code>{{ step.id }}</code>
      </details>
    </div>
  </section>
</template>
