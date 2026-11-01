<script setup lang="ts">
import { useStudioApp } from "../../composables/coforge/use-studio-app";
import AlertsView from './AlertsView.vue';
import ActiveJobDock from "./ActiveJobDock.vue";
import ActivityPopover from "./ActivityPopover.vue";
import BrandMark from "./BrandMark.vue";
import CfIcon from "./CfIcon.vue";
import ChatPanel from "./ChatPanel.vue";
import CommunityView from "./CommunityView.vue";
import PopulationView from "./PopulationView.vue";
import OperationsView from "./OperationsView.vue";
import CommunitySettingsView from "./CommunitySettingsView.vue";
import EconomyView from "./EconomyView.vue";
import BroadcastView from "./BroadcastView.vue";
import StreamStatisticsView from "./StreamStatisticsView.vue";
import FinanceView from "./FinanceView.vue";
import AICostsView from "./AICostsView.vue";
import ScheduleView from "./ScheduleView.vue";
import HelpDialog from "./HelpDialog.vue";
import IdeaBoard from "./IdeaBoard.vue";
import IdeaDrawer from "./IdeaDrawer.vue";
import NewIdeaDrawer from "./NewIdeaDrawer.vue";
import PipelineStrip from "./PipelineStrip.vue";
import SettingsView from "./SettingsView.vue";
import StreamPage from "./StreamPage.vue";
import TwitchOperationsView from './TwitchOperationsView.vue';
import StudioSidebar from "./StudioSidebar.vue";
import StudioTopbar from "./StudioTopbar.vue";
import ToastStack from "./ToastStack.vue";
import ProjectsView from "./ProjectsView.vue";
import CouncilView from "./CouncilView.vue";
import ServiceDesignView from './ServiceDesignView.vue';
import CoWorkersView from "./CoWorkersView.vue";
import ObsLiveDock from "./ObsLiveDock.vue";
import PolishingFeedbackDialog from './PolishingFeedbackDialog.vue';
import { usePolishingUiStore } from '../../stores/coforge-polishing-ui';

const model = useStudioApp();
const polishing = usePolishingUiStore();
</script>
<template>
  <div
    :ref="model.bindRoot"
    class="cf-studio"
    :class="[
      `cf-view-${model.shell.store.view}`,
      {
        'is-navigation-collapsed': model.shell.store.leftPanelCollapsed,
        'is-chat-expanded':
          model.shell.chatVisible &&
          model.shell.store.view === 'board' &&
          !model.shell.store.rightPanelCollapsed,
      },
    ]"
  >
    <div v-if="!model.shell.state" class="cf-startup-screen" role="status">
      <BrandMark />
      <h1>CoForge</h1>
      <template v-if="model.failure">
        <p role="alert">{{ model.failure }}</p>
        <p>
          Fix or move the file named above, then reload the plugin. CoForge
          never replaces invalid data with sample data.
        </p>
      </template>
      <template v-else>
        <CfIcon name="loader-circle" size="lg" class="cf-spin" />
        <p>Opening your community studio…</p>
      </template>
    </div>
    <template v-else>
      <StudioSidebar
        :id="`${model.shell.store.layoutId}-navigation`"
        v-show="!model.shell.store.leftPanelCollapsed"
      />
      <div class="cf-main">
        <StudioTopbar />
        <ObsLiveDock
          v-if="
            model.shell.broadcastVisible && (model.shell.store.view !== 'broadcast' ||
            model.shell.store.broadcastTool !== 'live')
          "
        />
        <div class="cf-workspace-body">
          <section class="cf-content" :aria-label="model.shell.viewLabel">
            <template v-if="model.shell.store.view === 'board'">
              <PipelineStrip v-if="model.shell.workflowVisible" />
              <IdeaBoard />
            </template>
            <StreamPage v-else-if="model.shell.store.view === 'stream'" />
            <TwitchOperationsView v-else-if="model.shell.store.view === 'twitch-operations'" />
            <BroadcastView v-else-if="model.shell.store.view === 'broadcast'" />
            <StreamStatisticsView
              v-else-if="model.shell.store.view === 'statistics'"
            />
            <FinanceView v-else-if="model.shell.store.view === 'finance'" />
            <AICostsView v-else-if="model.shell.store.view === 'ai-costs'" />
            <AlertsView v-else-if="model.shell.store.view === 'alerts'" />
            <ScheduleView v-else-if="model.shell.store.view === 'schedule'" />
            <CouncilView v-else-if="model.shell.store.view === 'council'" />
            <CoWorkersView v-else-if="model.shell.store.view === 'coworkers'" />
            <ServiceDesignView v-else-if="model.shell.store.view === 'service-design'" />
            <ProjectsView v-else-if="model.shell.store.view === 'projects'" />
            <CommunityView v-else-if="model.shell.store.view === 'community'" />
            <PopulationView
              v-else-if="model.shell.store.view === 'population'"
            />
            <OperationsView
              v-else-if="model.shell.store.view === 'operations'"
            />
            <CommunitySettingsView
              v-else-if="model.shell.store.view === 'community-settings'"
            />
            <EconomyView v-else-if="model.shell.store.view === 'economy'" />
            <SettingsView v-else />
          </section>
          <ChatPanel
            v-if="model.shell.chatVisible && model.shell.store.view === 'board'"
            :id="`${model.shell.store.layoutId}-chat`"
            :full="model.shell.store.narrowLayout"
            v-show="!model.shell.store.rightPanelCollapsed"
          />
        </div>
      </div>
      <ActiveJobDock
        v-if="model.shell.workflowVisible && model.shell.store.activeJob && model.shell.store.view === 'board'"
      />
      <ActivityPopover v-if="model.shell.store.activityOpen" />
      <IdeaDrawer v-if="model.shell.store.selectedIdea" v-show="!polishing.isOpen" :inert="polishing.isOpen || undefined" :aria-hidden="polishing.isOpen || undefined" />
      <PolishingFeedbackDialog v-if="polishing.isOpen" />
      <NewIdeaDrawer v-if="model.shell.store.creating" />
      <HelpDialog v-if="model.shell.store.help" />
    </template>
    <ToastStack />
  </div>
</template>
