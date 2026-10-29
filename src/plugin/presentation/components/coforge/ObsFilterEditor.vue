<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
const model = useObsProduction();
</script>
<template>
  <details class="cf-production-advanced">
    <summary>Source filters</summary>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="
        !model.connected || model.ui.pending || !model.ui.selectedInput
      "
      @click="model.readFilters()"
    >
      Load source filters
    </button>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>New filter name</span
        ><input v-model="model.ui.filterName" maxlength="128" /></label
      ><label class="cf-field"
        ><span>Filter type</span
        ><select v-model="model.ui.filterKind">
          <option value="">Choose a supported filter</option>
          <option
            v-for="kind in model.ui.snapshot?.filterKinds"
            :key="kind"
            :value="kind"
          >
            {{ kind }}
          </option>
        </select></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.canChange ||
          !model.ui.filterName ||
          !model.ui.filterKind ||
          !model.supports('filter-create')
        "
        @click="model.createFilter()"
      >
        Add filter
      </button>
    </div>
    <div
      v-for="filter in model.ui.filters"
      :key="filter.name"
      class="cf-production-output-row"
    >
      <div>
        <strong>{{ filter.name }}</strong
        ><span>{{ filter.kind }}</span>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canChange || !model.supports('filter-enabled')"
        @click="
          model.execute({
            kind: 'filter-enabled',
            inputId: model.ui.selectedInput,
            filterName: filter.name,
            enabled: !filter.enabled,
          })
        "
      >
        {{ filter.enabled ? "Disable" : "Enable" }} {{ filter.name }}
      </button>
    </div>
    <div v-if="model.ui.filters.length" class="cf-production-fields">
      <label class="cf-field"
        ><span>Filter to configure</span
        ><select v-model="model.ui.filterName">
          <option
            v-for="filter in model.ui.filters"
            :key="filter.name"
            :value="filter.name"
          >
            {{ filter.name }}
          </option>
        </select></label
      ><label class="cf-field"
        ><span>Filter property</span
        ><input
          v-model="model.ui.filterSetting"
          maxlength="80"
          placeholder="For example: threshold or db" /></label
      ><label class="cf-field"
        ><span>Filter value type</span
        ><select v-model="model.ui.filterValueType">
          <option value="number">Number</option>
          <option value="string">Text</option>
          <option value="boolean">Boolean (true or false)</option>
        </select></label
      ><label class="cf-field"
        ><span>Filter value</span
        ><input v-model="model.ui.filterValue" maxlength="1000" /></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.canChange || !model.ui.filterName || !model.ui.filterSetting
        "
        @click="model.saveFilter(model.ui.filterName)"
      >
        Apply filter property
      </button>
    </div>
    <details v-if="model.ui.filters.length" class="cf-production-advanced">
      <summary>Remove a source filter</summary>
      <label class="cf-field"
        ><span>Type the selected filter name to remove it</span
        ><input v-model="model.ui.removeFilterName" maxlength="128" /></label
      ><button
        type="button"
        class="cf-btn cf-btn-danger"
        :disabled="
          !model.canChange ||
          !model.ui.filterName ||
          model.ui.removeFilterName !== model.ui.filterName
        "
        @click="
          model.execute({
            kind: 'filter-remove',
            inputId: model.ui.selectedInput,
            filterName: model.ui.filterName,
            confirmed: true,
          })
        "
      >
        Remove {{ model.ui.filterName || "selected filter" }}
      </button>
    </details>
    <p>
      Supported filters start with OBS defaults. Detailed vendor-specific filter
      editors remain in OBS.
    </p>
  </details>
</template>
