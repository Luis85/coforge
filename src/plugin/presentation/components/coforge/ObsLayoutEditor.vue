<script setup lang="ts">
import { useObsLayout } from "../../composables/coforge/use-obs-layout";
const model = useObsLayout();
</script>
<template>
  <section class="cf-production-section" aria-label="Scene layout editor">
    <h3>Scene layout</h3>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Layout scene</span
        ><select v-model="model.production.ui.selectedScene">
          <option
            v-for="scene in model.production.scenes"
            :key="scene.id"
            :value="scene.id"
          >
            {{ scene.name }}
          </option>
        </select></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.production.connected ||
          model.production.ui.pending ||
          !model.production.ui.selectedScene
        "
        @click="model.production.readScene()"
      >
        Load scene layout
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.production.canChange || !model.production.ui.selectedScene
        "
        @click="model.production.showScene()"
      >
        Show selected scene in program
      </button>
    </div>
    <p>
      Showing a scene changes the current OBS program immediately. For
      rehearsal, keep broadcasting off and check the sampled layout image and
      audio before recording.
    </p>
    <div v-if="model.items.length" class="cf-production-fields">
      <label class="cf-field"
        ><span>Scene item</span
        ><select v-model.number="model.production.ui.itemId">
          <option v-for="item in model.items" :key="item.id" :value="item.id">
            {{ item.name }} · {{ item.enabled ? "visible" : "hidden" }}
          </option>
        </select></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.production.ui.pending"
        @click="model.production.readTransform()"
      >
        Load item transform
      </button>
    </div>
    <template v-if="model.production.ui.transform">
      <div
        v-if="
          model.production.editorFrameCurrent && model.production.ui.editorFrame
        "
        class="cf-production-layout-canvas"
      >
        <button
          type="button"
          class="cf-production-layout-image"
          aria-label="Place the selected source origin on this sampled scene image"
          @click="model.position"
        >
          <img
            :src="model.production.ui.editorFrame.dataUrl"
            alt="Sampled scene layout"
          /><span
            class="cf-production-layout-origin"
            :style="model.point"
            aria-hidden="true"
          />
        </button>
        <p>
          Click the image to place the source origin, or use the precise fields
          below. Apply commits the draft to OBS.
        </p>
      </div>
      <div class="cf-production-transform-fields">
        <label class="cf-field"
          ><span>Source alignment</span
          ><select v-model.number="model.production.ui.transform.alignment">
            <option :value="0">Center</option>
            <option :value="5">Top left</option>
            <option :value="6">Top right</option>
            <option :value="9">Bottom left</option>
            <option :value="10">Bottom right</option>
          </select></label
        >
        <label class="cf-field"
          ><span>Bounds sizing</span
          ><select v-model="model.production.ui.transform.boundsType">
            <option value="OBS_BOUNDS_NONE">No bounds</option>
            <option value="OBS_BOUNDS_STRETCH">Stretch to bounds</option>
            <option value="OBS_BOUNDS_SCALE_INNER">Fit inside bounds</option>
            <option value="OBS_BOUNDS_SCALE_OUTER">Fill bounds</option>
            <option value="OBS_BOUNDS_SCALE_TO_WIDTH">Fit width</option>
            <option value="OBS_BOUNDS_SCALE_TO_HEIGHT">Fit height</option>
            <option value="OBS_BOUNDS_MAX_ONLY">Limit to bounds</option>
          </select></label
        >
        <label class="cf-field"
          ><span>X position</span
          ><input
            v-model.number="model.production.ui.transform.positionX"
            type="number" /></label
        ><label class="cf-field"
          ><span>Y position</span
          ><input
            v-model.number="model.production.ui.transform.positionY"
            type="number"
        /></label>
        <label class="cf-field"
          ><span>Horizontal scale</span
          ><input
            v-model.number="model.production.ui.transform.scaleX"
            type="number"
            step="0.05" /></label
        ><label class="cf-field"
          ><span>Vertical scale</span
          ><input
            v-model.number="model.production.ui.transform.scaleY"
            type="number"
            step="0.05"
        /></label>
        <label class="cf-field"
          ><span>Rotation (degrees)</span
          ><input
            v-model.number="model.production.ui.transform.rotation"
            type="number"
            step="1"
        /></label>
        <label class="cf-field"
          ><span>Crop left</span
          ><input
            v-model.number="model.production.ui.transform.cropLeft"
            type="number"
            min="0" /></label
        ><label class="cf-field"
          ><span>Crop right</span
          ><input
            v-model.number="model.production.ui.transform.cropRight"
            type="number"
            min="0"
        /></label>
        <label class="cf-field"
          ><span>Crop top</span
          ><input
            v-model.number="model.production.ui.transform.cropTop"
            type="number"
            min="0" /></label
        ><label class="cf-field"
          ><span>Crop bottom</span
          ><input
            v-model.number="model.production.ui.transform.cropBottom"
            type="number"
            min="0"
        /></label>
        <label class="cf-field"
          ><span>Bounds width</span
          ><input
            v-model.number="model.production.ui.transform.boundsWidth"
            type="number"
            min="0" /></label
        ><label class="cf-field"
          ><span>Bounds height</span
          ><input
            v-model.number="model.production.ui.transform.boundsHeight"
            type="number"
            min="0"
        /></label>
      </div>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="
            !model.production.canChange ||
            !model.production.supports('item-transform')
          "
          @click="model.production.saveTransform()"
        >
          Apply layout</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.production.canChange ||
            !model.production.supports('item-lock')
          "
          @click="
            model.production.execute({
              kind: 'item-lock',
              sceneId: model.production.ui.selectedScene,
              itemId: model.production.ui.itemId,
              locked: true,
            })
          "
        >
          Lock source position</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.production.canChange ||
            !model.production.supports('item-lock')
          "
          @click="
            model.production.execute({
              kind: 'item-lock',
              sceneId: model.production.ui.selectedScene,
              itemId: model.production.ui.itemId,
              locked: false,
            })
          "
        >
          Unlock source position
        </button>
      </div>
    </template>
  </section>
</template>
