<script setup lang="ts">
import type { StreamSurfaceSnapshot } from "../../../features/coforge/domain/stream-surfaces";
defineProps<{ community: StreamSurfaceSnapshot["community"] }>();
</script>
<template>
  <section
    aria-label="Public community recognition"
    class="cf-stream-community-layout"
  >
    <div>
      <h2>The people building this world</h2>
      <p v-if="!community.contributors.length" class="cf-stream-empty">
        Share an idea, support a request or help finish an increment. Community
        achievements will appear here.
      </p>
      <ul class="cf-stream-community">
        <li
          v-for="(person, index) in community.contributors"
          :key="`${index}-${person.name}`"
        >
          <h3>{{ person.name }}</h3>
          <p class="cf-stream-person-stats">
            {{ person.ideas }} {{ person.ideas === 1 ? "idea" : "ideas" }} ·
            {{ person.votesReceived }}
            {{ person.votesReceived === 1 ? "vote" : "votes" }} ·
            {{ person.implementations }} accepted
          </p>
          <ul class="cf-stream-badges" aria-label="Earned badges">
            <li
              v-for="badge in person.badges.filter((badge) => badge.earned)"
              :key="badge.id"
            >
              <strong>{{ badge.title }}</strong
              ><span>{{ badge.description }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>
    <aside class="cf-stream-community-guide" aria-label="How to participate">
      <h2>Join as {{ community.actorName }}</h2>
      <p>
        Type <code>!register</code> in chat, then use <code>!projects</code> to
        find the game you want to help build.
      </p>
      <h3>Community rewards</h3>
      <p>
        Each tracked live chat-presence minute earns
        {{ community.rules.coinsPerMinute }} {{ community.currencyName }} and
        {{ community.rules.xpPerMinute }} XP.
      </p>
      <p>
        Screened feature: {{ community.rules.screenedXp }} XP +
        {{ community.rules.screenedReputation }} reputation.
      </p>
      <p>
        Accepted feature: {{ community.rules.acceptedXp }} XP +
        {{ community.rules.acceptedReputation }} reputation.
      </p>
      <p class="cf-stream-muted">
        Chat presence is not verified video watch time.
      </p>
      <h3>Rank ladder</h3>
      <ol class="cf-stream-rank-ladder">
        <li v-for="(rank, index) in community.ranks" :key="index">
          <strong>{{ rank.name }}</strong
          ><span>{{ rank.minimumXp.toLocaleString() }} XP</span>
        </li>
      </ol>
      <p>
        <code>!me</code> shows your progress. <code>!ranks</code> lists the
        ladder.
      </p>
    </aside>
  </section>
</template>
