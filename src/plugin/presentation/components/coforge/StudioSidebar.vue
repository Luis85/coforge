<script setup lang="ts">
import { useStudioNavigation } from "../../composables/coforge/use-studio-navigation";
import BrandMark from "./BrandMark.vue";
import CfIcon from "./CfIcon.vue";

const { shell: model, groups, settings, navigate, toggleGroup } = useStudioNavigation();
</script>
<template>
  <aside class="cf-sidebar">
    <button
      type="button"
      class="cf-brand"
      aria-label="CoForge studio"
      @click="model.store.navigate('broadcast')"
    >
      <BrandMark />
      <span>CoForge</span>
    </button>
    <button
      type="button"
      class="cf-project-switcher"
      :class="{ 'is-active': model.store.view === 'projects' }"
      :aria-current="model.store.view === 'projects' ? 'page' : undefined"
      title="Manage projects"
      @click="model.manageProjects()"
    >
      <span class="cf-project-icon"><CfIcon name="gamepad-2" /></span>
      <span>
        <strong>{{
          model.store.activeProject
            ? model.state?.settings.projectName
            : "Projects"
        }}</strong>
        <span v-if="model.store.activeProject" class="cf-project-selector-meta">
          <code class="cf-project-selector-id">{{ model.store.activeProject.id }}</code>
          <span v-if="model.store.activeProject.visibility === 'private'" class="cf-project-visibility" aria-label="Private project">Private</span>
        </span>
        <small v-else>Add or select a project</small>
      </span>
      <CfIcon name="chevron-right" size="xs" />
    </button>
    <nav aria-label="CoForge navigation">
      <div class="cf-navigation-groups">
      <div
        v-for="group in groups"
        :key="group.id"
        class="cf-nav-group"
        role="group"
        :aria-label="`${group.label} navigation`"
      >
        <button type="button" class="cf-nav-group-toggle" :aria-label="`${group.expanded ? 'Collapse' : 'Expand'} ${group.label}`" :aria-expanded="group.expanded" :aria-controls="group.controls" :title="`${group.expanded ? 'Collapse' : 'Expand'} ${group.label}`" @click="toggleGroup(group.id)">
          <span class="cf-nav-group-label">{{ group.label }}</span>
          <CfIcon :name="group.expanded ? 'chevron-down' : 'chevron-right'" size="xs" />
        </button>
        <div :id="group.controls" v-show="group.expanded" class="cf-nav-group-items">
        <button
          v-for="item in group.items"
          :key="item.view"
          type="button"
          class="cf-nav-item"
          :class="{ 'is-active': item.active }"
          :aria-current="item.active ? 'page' : undefined"
          :title="
            item.disabled
              ? `Select a project to open ${item.label}`
              : item.label
          "
          :disabled="item.disabled"
          @click="navigate(item.view)"
        >
          <CfIcon :name="item.icon" />
          <span>{{ item.label }}</span>
          <span v-if="item.count !== undefined" class="cf-nav-count">{{
            item.count
          }}</span>
          <span v-if="item.working" class="cf-nav-working-dot" />
        </button>
        </div>
      </div>
      </div>
      <button v-if="settings" type="button" class="cf-nav-item cf-settings-destination"
        :class="{ 'is-active': settings.active }" :aria-current="settings.active ? 'page' : undefined"
        :title="settings.label" :aria-label="settings.label" @click="navigate('settings')">
        <CfIcon :name="settings.icon" /><span>{{ settings.label }}</span>
      </button>
    </nav>
    <div class="cf-sidebar-bottom">
      <button
        type="button"
        class="cf-nav-item"
        aria-label="How it works"
        title="How it works"
        @click="model.store.help = true"
      >
        <CfIcon name="circle-help" />
        <span>How it works</span>
      </button>
      <div v-if="model.streamVisible" class="cf-streamer-profile">
        <div>
          <strong>{{
            model.state?.runtime.twitch?.streamer?.login ||
            "Twitch not connected"
          }}</strong>
          <small>{{
            model.state?.runtime.twitch?.message || "Connect in Stream chat"
          }}</small>
        </div>
        <span class="cf-version-tag">0.1</span>
      </div>
    </div>
  </aside>
</template>
