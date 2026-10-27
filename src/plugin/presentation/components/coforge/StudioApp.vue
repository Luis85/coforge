<script setup lang="ts">
import { useStudioApp } from '../../composables/coforge/use-studio-app';
import ActiveJobDock from './ActiveJobDock.vue';
import ActivityPopover from './ActivityPopover.vue';
import BrandMark from './BrandMark.vue';
import CfIcon from './CfIcon.vue';
import ChatPanel from './ChatPanel.vue';
import CommunityView from './CommunityView.vue';
import PopulationView from './PopulationView.vue';
import OperationsView from './OperationsView.vue';
import CommunitySettingsView from './CommunitySettingsView.vue';
import HelpDialog from './HelpDialog.vue';
import IdeaBoard from './IdeaBoard.vue';
import IdeaDrawer from './IdeaDrawer.vue';
import NewIdeaDrawer from './NewIdeaDrawer.vue';
import PipelineStrip from './PipelineStrip.vue';
import SettingsView from './SettingsView.vue';
import StreamPage from './StreamPage.vue';
import StudioSidebar from './StudioSidebar.vue';
import StudioStatusbar from './StudioStatusbar.vue';
import StudioTopbar from './StudioTopbar.vue';
import ToastStack from './ToastStack.vue';
import WorkflowView from './WorkflowView.vue';
import ProjectsView from './ProjectsView.vue';

const model = useStudioApp();
</script>
<template>
  <div class="cf-studio" :class="`cf-view-${model.shell.store.view}`">
    <div v-if="!model.shell.state" class="cf-startup-screen" role="status">
      <BrandMark />
      <h1>CoForge</h1>
      <template v-if="model.failure">
        <p role="alert">{{ model.failure }}</p>
        <p>Fix or move the file named above, then reload the plugin. CoForge never replaces invalid data with sample data.</p>
      </template>
      <template v-else>
        <CfIcon name="loader-circle" size="lg" class="cf-spin" />
        <p>Opening your community studio…</p>
      </template>
    </div>
    <template v-else>
      <StudioSidebar />
      <div class="cf-main">
        <StudioTopbar />
        <div class="cf-workspace-body">
          <main class="cf-content">
            <template v-if="model.shell.store.view === 'board'">
              <PipelineStrip />
              <IdeaBoard />
            </template>
            <StreamPage v-else-if="model.shell.store.view === 'stream'" />
            <WorkflowView v-else-if="model.shell.store.view === 'workflow'" />
            <ProjectsView v-else-if="model.shell.store.view === 'projects'" />
            <CommunityView v-else-if="model.shell.store.view === 'community'" />
            <PopulationView v-else-if="model.shell.store.view === 'population'" />
            <OperationsView v-else-if="model.shell.store.view === 'operations'" />
            <CommunitySettingsView v-else-if="model.shell.store.view === 'community-settings'" />
            <SettingsView v-else />
          </main>
          <ChatPanel v-if="model.shell.store.view === 'board'" />
        </div>
        <StudioStatusbar />
      </div>
      <ActiveJobDock v-if="model.shell.store.activeJob && model.shell.store.view === 'board'" />
      <ActivityPopover v-if="model.shell.store.activityOpen" />
      <IdeaDrawer v-if="model.shell.store.selectedIdea" />
      <NewIdeaDrawer v-if="model.shell.store.creating" />
      <HelpDialog v-if="model.shell.store.help" />
    </template>
    <ToastStack />
  </div>
</template>
