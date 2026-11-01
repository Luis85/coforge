<script setup lang="ts">
import UContextMenu from "@nuxt/ui/components/ContextMenu.vue";
import UDropdownMenu from "@nuxt/ui/components/DropdownMenu.vue";
import type { Idea } from "../../../features/coforge/domain/types";
import { useIdeaCard } from "../../composables/coforge/use-board-card";
import CfIcon from "./CfIcon.vue";
import MarkdownBody from "./MarkdownBody.vue";
import { useIdeaCardMenu } from "../../composables/coforge/use-idea-card-menu";

const props = defineProps<{ idea: Idea }>();
const model = useIdeaCard(props);
const menu = useIdeaCardMenu(props, model);
</script>
<template>
  <UContextMenu
    :items="menu.items"
    :portal="menu.portal"
    :open="menu.contextOpen"
    :content="menu.contextContent"
    :ui="{ content: 'cf-card-menu' }"
    @update:open="menu.contextChanged"
    ><article
      :ref="menu.bindCard"
      class="cf-idea-card"
      :data-idea-id="model.idea.id"
      tabindex="-1"
      :class="{ 'is-flagged': model.flagged, 'is-review': model.review }"
      @keydown="menu.keydown"
    >
      <button
        type="button"
        class="cf-idea-open"
        :title="model.openLabel"
        @click="model.open()"
      >
        <div class="cf-idea-card-top">
          <span class="cf-idea-id">{{ model.idea.id }}</span>
          <span v-if="model.idea.requestKind === 'bug'" class="cf-badge"
            >Bug</span
          >
          <span
            class="cf-category-dot"
            :class="model.categoryClass"
            :title="model.idea.category"
          />
          <span class="cf-idea-category">{{ model.idea.category }}</span>
        </div>
        <h3>{{ model.idea.title }}</h3>
        <MarkdownBody
          class="cf-idea-description"
          :source="model.idea.description"
          compact
          :links="false"
        />
        <div v-if="model.state || model.polishingState" class="cf-card-states">
          <span
            v-if="model.state"
            class="cf-card-state"
            :class="`cf-state-${model.state.tone}`"
          >
            <CfIcon
              :name="model.state.icon"
              size="xs"
              :class="{ 'cf-spin': model.state.spin }"
            />
            {{ model.state.label }}
          </span>
          <span v-if="model.polishingState" class="cf-card-state cf-card-polishing-state"
            :class="`cf-state-${model.polishingState.tone}`" :data-polishing-status="model.polishingState.status"
            :title="model.polishingState.description" role="status" aria-label="Polishing status" aria-live="polite" aria-atomic="true">
            <CfIcon :name="model.polishingState.icon" size="xs" :class="{ 'cf-spin': model.polishingState.spin }" />
            <span>{{ model.polishingState.label }}</span>
          </span>
        </div>
      </button>
      <div class="cf-idea-card-footer">
        <div class="cf-idea-author" :title="model.authorName">
          <span class="cf-avatar cf-avatar-sm" :style="model.avatar">{{
            model.authorInitials
          }}</span>
          <span>{{ model.authorName }}</span>
        </div>
        <div class="cf-idea-card-numbers">
          <span
            v-if="model.rice !== null"
            class="cf-rice-mini"
            :title="model.riceTitle"
          >
            <CfIcon name="sparkles" size="xs" />{{ model.rice }}
          </span>
          <button
            type="button"
            class="cf-vote-button"
            :class="{ 'is-voted': model.voted }"
            :disabled="model.voteDisabled"
            :aria-label="model.voteLabel"
            :title="model.voteTitle"
            @click="model.vote()"
          >
            <CfIcon name="arrow-up" size="sm" />
            <span>{{ model.idea.voters.length }}</span>
          </button>
          <UDropdownMenu
            :items="menu.items"
            :portal="menu.portal"
            :open="menu.dropdownOpen"
            :content="menu.dropdownContent"
            :ui="{ content: 'cf-card-menu' }"
            @update:open="menu.dropdownChanged"
            ><button
              type="button"
              class="cf-icon-button cf-card-menu-button"
              :aria-label="`Actions for ${model.idea.id}`"
            >
              <CfIcon name="ellipsis" size="sm" /></button
          ></UDropdownMenu>
        </div>
      </div></article
  ></UContextMenu>
</template>
