<script setup lang="ts">
import type {
  ObsSceneDetail,
  ObsSceneItem,
} from "../../../features/coforge/domain/obs-scenes";
defineProps<{ detail: ObsSceneDetail; disabled: boolean }>();
defineEmits<{
  visible: [item: ObsSceneItem];
  order: [item: ObsSceneItem, direction: "up" | "down"];
  remove: [item: ObsSceneItem];
}>();
</script>
<template>
  <section class="cf-obs-source-list" aria-label="Scene sources">
    <h3>Sources in this scene</h3>
    <p v-if="!detail.items.length">
      This scene has no sources. Add an existing source below, or create a new
      source in OBS.
    </p>
    <ol v-else aria-label="Source layer order">
      <li v-for="item in detail.items" :key="item.id">
        <div class="cf-obs-source-name">
          <strong>{{ item.name }}</strong
          ><small
            >Layer {{ item.index + 1 }} · {{ item.kind
            }}{{ item.locked ? " · layout locked" : "" }}</small
          >
        </div>
        <div class="cf-obs-source-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="disabled || !detail.available.includes('item-visible')"
            :aria-label="`${item.enabled ? 'Hide' : 'Show'} source ${item.name}`"
            @click="$emit('visible', item)"
          >
            {{ item.enabled ? "Hide" : "Show" }}
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              disabled ||
              item.index >= detail.items.length - 1 ||
              !detail.available.includes('item-order')
            "
            :aria-label="`Move ${item.name} up`"
            @click="$emit('order', item, 'up')"
          >
            Up
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="
              disabled ||
              item.index === 0 ||
              !detail.available.includes('item-order')
            "
            :aria-label="`Move ${item.name} down`"
            @click="$emit('order', item, 'down')"
          >
            Down
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="disabled || !detail.available.includes('item-remove')"
            :aria-label="`Remove source ${item.name}`"
            @click="$emit('remove', item)"
          >
            Remove
          </button>
        </div>
      </li>
    </ol>
    <p class="cf-settings-help">
      Top layer is shown first. Groups are managed as whole items; edit their
      contents and source properties in OBS.
    </p>
  </section>
</template>
