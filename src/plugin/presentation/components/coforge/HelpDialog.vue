<script setup lang="ts">
import { useHelpDialog } from '../../composables/coforge/use-help-dialog';
import BrandMark from './BrandMark.vue';
import CfIcon from './CfIcon.vue';

const model = useHelpDialog();
</script>
<template>
  <div class="cf-overlay cf-help-overlay" @mousedown="model.focus.backdrop">
    <section :ref="model.focus.bind" class="cf-help-dialog" role="dialog" aria-modal="true" aria-labelledby="cf-help-title" @keydown="model.focus.keydown">
      <header>
        <BrandMark />
        <button type="button" class="cf-icon-button" aria-label="Close guide" @click="model.close()"><CfIcon name="x" size="lg" /></button>
      </header>
      <h2 id="cf-help-title">Build with your community</h2>
      <p>Prepare your stream in Stream. Develop project requests in Build. Recognize contributors in Community, and inspect recorded results in Insights. Every idea remains a note in your vault.</p>
      <ol class="cf-help-steps">
        <li>
          <span>1</span>
          <div>
            <strong>Let the community pitch.</strong>
            <p>In a local command test, send <code>!register</code>, then <code>!request CFP-001 Add fishing</code>, using the project ID shown in Projects. Features have a five-minute cooldown.</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Give good ideas a path.</strong>
            <p>Vote with <code>!vote CF-101</code>. Run an individual stage, or enable the loops to screen, score, plan, and build.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Review the work. Credit the people.</strong>
            <p>Inspect the plan and increment before accepting. Recognition and badges follow the contributor’s actual progress.</p>
          </div>
        </li>
      </ol>
      <div class="cf-help-demo-note">
        <CfIcon name="sparkles" />
        <p>The sample workspace uses simulated chat and agent results. Try the full loop without accounts or API usage.</p>
      </div>
      <button type="button" class="cf-btn cf-btn-primary" @click="model.start()">
        Explore the agent workflow <CfIcon name="arrow-right" />
      </button>
    </section>
  </div>
</template>
