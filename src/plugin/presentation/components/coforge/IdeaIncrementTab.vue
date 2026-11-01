<script setup lang="ts">
import type { Idea } from "../../../features/coforge/domain/types";
import { useIdeaDrawerContext } from "../../composables/coforge/use-idea-drawer";
import { useIncrementReview } from "../../composables/coforge/use-increment-review";
import CfIcon from "./CfIcon.vue";
import MarkdownBody from "./MarkdownBody.vue";
import WorkflowVerificationEvidence from './WorkflowVerificationEvidence.vue';
import IncrementCodingObservations from './IncrementCodingObservations.vue';

const props = defineProps<{ idea: Idea }>();
const drawer = useIdeaDrawerContext();
const review = useIncrementReview(props);
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
      <p class="cf-idea-help">Agent-reported summary · review against the captured changes and criteria.</p>
      <p v-if="review.evidence.polishing" class="cf-idea-help">Reviewed polishing output · producing run <code>{{ review.evidence.polishing.runId }}</code> · artifact <code>{{ review.evidence.polishing.artifactId }}</code>. The current workspace belongs to <code>{{ review.evidence.polishing.ownerRunId }}</code>; earlier primary assessments are retained in Workflow runs and do not assess these new bytes.</p>
      <MarkdownBody class="cf-idea-body" :source="idea.increment.summary" />
    </section>
    <section v-if="review.evidence.followups.length" class="cf-idea-section" aria-label="Post-build findings">
      <h3><CfIcon name="clipboard-check" /> Post-build findings</h3>
      <p class="cf-idea-help">Agent assessments of this increment. Completed runs do not verify acceptance or replace your decision.</p>
      <details v-for="finding in review.evidence.followups" :key="finding.id" class="cf-idea-evidence cf-increment-finding" open>
        <summary>{{ finding.name }} <span class="cf-idea-run-meta">{{ finding.assessmentLabel }} · <time :datetime="finding.createdAt">{{ finding.savedLabel }}</time></span></summary>
        <MarkdownBody class="cf-idea-body" :source="finding.markdown" />
      </details>
    </section>
    <section class="cf-idea-section" aria-label="Planned acceptance criteria">
      <h3><CfIcon name="list-checks" /> Acceptance criteria</h3>
      <p v-if="review.evidence.polishing" class="cf-idea-help">Captured plan input · not verified. Only intact criteria bound to the producing polishing attempt are shown; current project plans and earlier assessments are not substituted.</p>
      <p v-else class="cf-idea-help">Saved plan · not verified. Check each criterion against the increment and verification evidence.</p>
      <ul v-if="review.evidence.criteria.length" class="cf-idea-check-list">
        <li v-for="(criterion, index) in review.evidence.criteria" :key="index">
          <span class="cf-idea-check-box" aria-hidden="true" />
          <MarkdownBody :source="criterion" />
        </li>
      </ul>
      <p v-else class="cf-idea-help">No saved acceptance criteria are bound to this Build. Inspect Plan &amp; Design and Workflow runs for earlier context.</p>
    </section>
    <section class="cf-idea-section">
      <h3><CfIcon name="file-code" /> {{ idea.increment.simulated ? 'Illustrative changes' : review.evidence.hostCaptured ? 'Host-captured changes' : 'Recorded changes' }}</h3>
      <p v-if="!idea.increment.simulated && review.evidence.hostCaptured" class="cf-idea-help">CoForge captured these files and the diff from the worktree. This records changes; it does not prove they work.</p>
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
    <IncrementCodingObservations :idea="idea" :source="review.evidence.producingAttempt" />
    <section class="cf-idea-section">
      <h3><CfIcon name="flask-conical" /> Verification notes</h3>
      <p class="cf-idea-help">Read the recorded outcomes and limitations below. Written tests and successful agent runs are not executed checks.</p>
      <p v-if="review.evidence.postBuildChecks.length" class="cf-idea-help">Earlier Build notes do not describe the later command executions shown below. Compare each recorded source fingerprint before reviewing acceptance.</p>
      <ul v-if="review.verificationNotes.length" class="cf-idea-list">
        <li v-for="(test, index) in review.verificationNotes" :key="index">
          <MarkdownBody :source="test" />
        </li>
      </ul>
      <p v-else-if="!review.evidence.postBuildChecks.length" class="cf-idea-help">
        No test results were reported. Verify the increment in the game project
        before accepting it.
      </p>
    </section>
    <div v-for="check in review.evidence.postBuildChecks" :key="check.id" class="cf-idea-section" role="region" :aria-label="`Post-build verification for ${check.name}`">
      <h3>{{ check.name }} · {{ check.jobStatus }}</h3>
      <p class="cf-idea-help">Observed on this step's captured review snapshot. A source match is shown only when the increment has a recorded comparison fingerprint.</p>
      <WorkflowVerificationEvidence :records="check.records" :current-hash="check.currentHash" />
    </div>
    <WorkflowVerificationEvidence :records="review.evidence.polishing ? review.evidence.verification ?? [] : idea.increment.verification ?? []" :current-hash="review.evidence.polishing ? undefined : idea.increment.verificationSourceHash" :historical="review.evidence.historicalVerification" />
    <section class="cf-idea-section">
      <h3>
        <CfIcon name="file-code" />
        {{
          idea.increment.simulated ? "Illustrative diff" : "Working tree diff"
        }}
      </h3>
      <pre class="cf-idea-code" tabindex="0" role="region" :aria-label="idea.increment.simulated ? 'Illustrative diff' : 'Working tree diff'">{{
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
