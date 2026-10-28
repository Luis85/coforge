<script setup lang="ts">
import { useStudioNavigation } from "../../composables/coforge/use-studio-navigation";
import BrandMark from "./BrandMark.vue";
import CfIcon from "./CfIcon.vue";

const { shell: model, groups } = useStudioNavigation();
</script>
<template>
  <aside class="cf-sidebar">
    <button
      type="button"
      class="cf-brand"
      aria-label="CoForge board"
      @click="model.store.navigate('board')"
    >
      <BrandMark />
      <span>CoForge</span>
    </button>
    <button
      type="button"
      class="cf-project-switcher"
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
        <code v-if="model.store.activeProject" class="cf-project-selector-id">{{
          model.store.activeProject.id
        }}</code>
        <small v-else>Add or select a project</small>
      </span>
      <CfIcon name="chevron-right" size="xs" />
    </button>
    <nav aria-label="CoForge navigation">
      <div
        v-for="group in groups"
        :key="group.id"
        class="cf-nav-group"
        role="group"
        :aria-label="`${group.label} navigation`"
      >
        <div class="cf-nav-group-label">{{ group.label }}</div>
        <button
          v-for="item in group.items"
          :key="item.view"
          type="button"
          class="cf-nav-item"
          :class="{ 'is-active': item.active }"
          :aria-current="item.active ? 'page' : undefined"
          :title="item.label"
          :disabled="
            !model.store.activeProject &&
            (item.view === 'board' || item.view === 'workflow')
          "
          @click="model.store.navigate(item.view)"
        >
          <CfIcon :name="item.icon" />
          <span>{{ item.label }}</span>
          <span v-if="item.count !== undefined" class="cf-nav-count">{{
            item.count
          }}</span>
          <span v-if="item.working" class="cf-nav-working-dot" />
        </button>
      </div>
    </nav>
    <div class="cf-sidebar-bottom">
      <button
        type="button"
        class="cf-nav-item"
        :class="{ 'is-active': model.store.view === 'community-settings' }"
        :aria-current="
          model.store.view === 'community-settings' ? 'page' : undefined
        "
        aria-label="Community settings"
        title="Community settings"
        @click="model.store.navigate('community-settings')"
      >
        <CfIcon name="users-round" /><span>Community settings</span>
      </button>
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
      <button
        type="button"
        class="cf-nav-item"
        :class="{ 'is-active': model.store.view === 'settings' }"
        :aria-current="model.store.view === 'settings' ? 'page' : undefined"
        aria-label="Project settings"
        title="Project settings"
        @click="model.store.navigate('settings')"
      >
        <CfIcon name="settings" />
        <span>Project settings</span>
      </button>
      <div class="cf-streamer-profile">
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
