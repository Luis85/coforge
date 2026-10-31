<script setup lang="ts">
import type { Idea } from "../../../features/coforge/domain/types";
import { useIdeaDrawerContext } from "../../composables/coforge/use-idea-drawer";
import CfIcon from "./CfIcon.vue";
import MarkdownBody from "./MarkdownBody.vue";

defineProps<{ idea: Idea }>();
const drawer = useIdeaDrawerContext();
</script>
<template>
  <template v-if="idea.increment">
    <div v-if="idea.increment.simulated" class="cf-idea-alert is-agent">
      <CfIcon name="flask-conical" />
      <span>
        <strong>Simulated increment</strong>
        <small
          >This is an illustrative artifact for exploring the review flow. It
          has not changed game files or run tests.</small
        >
      </span>
    </div>
    <section class="cf-idea-section">
      <h3>
        <CfIcon name="code" /> What changed
        <span v-if="idea.increment.simulated" class="cf-badge">Demo</span>
      </h3>
      <MarkdownBody class="cf-idea-body" :source="idea.increment.summary" />
      <div
        v-if="idea.increment.branch"
        class="cf-idea-code-meta"
        title="Branch"
      >
        <CfIcon name="git-branch" size="sm" />
        <span class="cf-sr-only">Branch</span>
        <code>{{ idea.increment.branch }}</code>
      </div>
      <div
        v-if="idea.increment.worktree"
        class="cf-idea-code-meta"
        title="Worktree path"
      >
        <CfIcon name="folder-git-2" size="sm" />
        <span class="cf-sr-only">Worktree path</span>
        <code>{{ idea.increment.worktree }}</code>
      </div>
      <ul class="cf-idea-files">
        <li v-for="(file, index) in idea.increment.files" :key="index">
          <CfIcon name="file-code" />
          <code>{{ file.path }}</code>
          <span class="cf-idea-additions"
            >+{{ file.additions
            }}<span class="cf-sr-only"> additions</span></span
          >
          <span class="cf-idea-deletions"
            >−{{ file.deletions
            }}<span class="cf-sr-only"> deletions</span></span
          >
        </li>
      </ul>
    </section>
    <section class="cf-idea-section">
      <h3><CfIcon name="flask-conical" /> Verification notes</h3>
      <ul v-if="idea.increment.tests.length" class="cf-idea-list">
        <li v-for="(test, index) in idea.increment.tests" :key="index">
          <MarkdownBody :source="test" />
        </li>
      </ul>
      <p v-else class="cf-idea-help">
        No test results were reported. Verify the increment in the game project
        before accepting it.
      </p>
    </section>
    <section class="cf-idea-section">
      <h3>
        <CfIcon name="file-code" />
        {{
          idea.increment.simulated ? "Illustrative diff" : "Working tree diff"
        }}
      </h3>
      <pre class="cf-idea-code" tabindex="0">{{
        idea.increment.diff || "No diff available."
      }}</pre>
    </section>
    <div
      v-if="drawer.reviewable && drawer.canFinalReview"
      class="cf-idea-alert"
    >
      <CfIcon name="clipboard-check" />
      <span
        >Review the files, acceptance criteria, and verification notes before
        making your decision below.</span
      >
    </div>
  </template>
  <div v-else class="cf-idea-empty">
    <CfIcon name="code" size="lg" />
    <h3>The next increment starts here</h3>
    <p>
      A workflow that changes code records its changed files, diff and
      verification notes here for your review. A workflow can also finish without code changes.
    </p>
    <button
      v-if="drawer.workflowVisible"
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="drawer.openWorkflow()"
    >
      Open workflow <CfIcon name="arrow-right" />
    </button>
  </div>
</template>
