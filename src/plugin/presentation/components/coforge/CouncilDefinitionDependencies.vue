<script setup lang="ts">
import type { CouncilCatalogueActions } from "../../../features/coforge/application/council-catalogue";
import { useCouncilDependencies } from "../../composables/coforge/use-council-dependencies";
const props = defineProps<{
  catalogue: CouncilCatalogueActions;
  definitionId: string;
}>();
const model = useCouncilDependencies(props);
</script>
<template>
  <section aria-label="Definition dependencies">
    <h3>Where this definition is used</h3>
    <p v-if="model.store.loading" role="status">Loading references…</p>
    <p v-if="model.store.error" role="alert" class="cf-inline-error">
      {{ model.store.error }}
    </p>
    <p
      v-if="!model.store.loading && !model.store.snapshot.items.length"
      class="cf-settings-help"
    >
      No references were found in the checked definitions.
    </p>
    <ul v-else>
      <li
        v-for="item in model.store.snapshot.items"
        :key="`${item.kind}:${item.id}`"
      >
        {{ item.name }} · {{ item.kind }} ·
        {{ item.enabled ? "Enabled" : "Disabled" }} <code>{{ item.id }}</code>
      </li>
    </ul>
    <p
      v-if="!model.store.loading && !model.store.snapshot.complete"
      class="cf-settings-help"
    >
      Workflow and inbox references are not fully checked here. Use the desktop
      catalogue, or repair unavailable project notes and refresh, before relying
      on this list.
    </p>
    <p class="cf-settings-help">
      Archiving blocks dependent future actions. Preserved runs and results
      remain available for inspection.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-ghost"
      :disabled="model.store.loading"
      @click="model.refresh()"
    >
      Refresh dependencies
    </button>
  </section>
</template>
