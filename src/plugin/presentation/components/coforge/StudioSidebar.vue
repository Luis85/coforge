<script setup lang="ts">
import { useStudioShell } from '../../composables/coforge/use-studio-app';
import BrandMark from './BrandMark.vue';
import CfIcon from './CfIcon.vue';

const model = useStudioShell();
</script>
<template>
  <aside class="cf-sidebar">
    <button type="button" class="cf-brand" aria-label="CoForge board" @click="model.store.navigate('board')">
      <BrandMark />
      <span>CoForge</span>
    </button>
    <button type="button" class="cf-project-switcher" title="Manage projects" @click="model.manageProjects()">
      <span class="cf-project-icon"><CfIcon name="gamepad-2" /></span>
      <span>
        <strong>{{ model.state?.settings.projectName }}</strong>
        <small>Community game project · {{ model.store.activeProject?.id }}</small>
      </span>
      <CfIcon name="chevron-right" size="xs" />
    </button>
    <div class="cf-sidebar-label">WORKSPACE</div>
    <nav aria-label="CoForge navigation">
      <button
        v-for="item in model.nav" :key="item.view" type="button" class="cf-nav-item" :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined" :title="item.label" @click="model.store.navigate(item.view)"
      >
        <CfIcon :name="item.icon" />
        <span>{{ item.label }}</span>
        <span v-if="item.count !== undefined" class="cf-nav-count">{{ item.count }}</span>
        <span v-if="item.working" class="cf-nav-working-dot" />
      </button>
    </nav>
    <div class="cf-sidebar-community">
      <div class="cf-stacked-avatars">
        <span v-for="person in model.sidebarPeople" :key="person.id" :style="person.style">{{ person.letter }}</span>
      </div>
      <strong>Made with your people.</strong>
      <p>{{ model.state?.contributors.length ?? 0 }} contributors.<br>One game, built together.</p>
      <button type="button" class="cf-link-button" @click="model.store.navigate('community')">
        Meet the community <CfIcon name="arrow-up-right" size="xs" />
      </button>
    </div>
    <div class="cf-sidebar-bottom">
      <button type="button" class="cf-nav-item" aria-label="How it works" title="How it works" @click="model.store.help = true">
        <CfIcon name="circle-help" />
        <span>How it works</span>
      </button>
      <button
        type="button" class="cf-nav-item" :class="{ 'is-active': model.store.view === 'settings' }" aria-label="Studio settings"
        title="Studio settings" @click="model.store.navigate('settings')"
      >
        <CfIcon name="settings" />
        <span>Studio settings</span>
      </button>
      <div class="cf-streamer-profile">
        <span class="cf-avatar">YO</span>
        <div>
          <strong>Your studio</strong>
          <small><span class="cf-status-dot is-active" /> In this vault</small>
        </div>
        <span class="cf-version-tag">0.1</span>
      </div>
    </div>
  </aside>
</template>
