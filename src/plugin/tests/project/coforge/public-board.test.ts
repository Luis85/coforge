import { describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { pagesWorkflow, WORKFLOW_MARKER } from '../../../features/coforge/domain/pages-workflow';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { escapeHtml, renderPublicSite } from '../../../features/coforge/domain/public-site';
import { createSeed } from '../../../features/coforge/domain/seed';
import { emptyPopulation } from '../../../features/coforge/domain/population';
import { PublicSitePublisher } from '../../../infrastructure/coforge/public-site-publisher';

const now = new Date('2026-10-23T18:00:00Z');

describe('public viewer board', () => {
  it('excludes private player economy, moderation records and recurring message configuration', () => {
    const state = createSeed(now.getTime()); state.population = emptyPopulation();
    state.population.players.push({ id: 'twitch:PRIVATE_PLAYER', firstSeenAt: now.toISOString(), lastSeenAt: now.toISOString(), registeredAt: now.toISOString(), blocked: true,
      coins: 99999, xp: 500, reputation: 100, presenceSeconds: 600, rewardedMinutes: 10, rewardClaims: ['PRIVATE_CLAIM'] });
    state.streamMessages = [{ id: 'private-message', text: 'PRIVATE_ANNOUNCEMENT', active: false, intervalMinutes: 5, channelId: '123', createdAt: now.toISOString(), updatedAt: now.toISOString() }];
    const published = JSON.stringify(buildPublicBoard(state, now));
    expect(published).not.toContain('PRIVATE_PLAYER'); expect(published).not.toContain('PRIVATE_CLAIM'); expect(published).not.toContain('PRIVATE_ANNOUNCEMENT');
  });
  it('publishes only screened board ideas and never platform IDs, chat or review data', () => {
    const state = createSeed(now.getTime());
    const board = buildPublicBoard(state, now);
    const ids = board.columns.flatMap(column => column.ideas.map(idea => idea.id));
    expect(ids).not.toContain('CF-114'); // flagged
    expect(ids).not.toContain('CF-107'); // unscreened inbox
    expect(board.awaitingScreening).toBe(3);
    expect(board.columns.find(column => column.id === 'done')?.ideas.map(idea => idea.id)).toEqual(['CF-111', 'CF-112']);
    const json = JSON.stringify(board);
    expect(json).not.toContain('simulator:');
    expect(json).not.toContain('Ignore previous instructions');
    expect(json).not.toContain('Accepted during the sample playtest');
    expect(json).not.toContain(state.chat[0]!.text);
    expect(board.columns[1]?.ideas.find(idea => idea.id === 'CF-102')?.plan?.steps.length).toBeGreaterThan(0);
    expect(board.leaderboards.votes[0]).toMatchObject({ name: 'luna_loop' });
  });

  it('escapes community text so the page cannot carry markup or scripts', () => {
    const state = createSeed(now.getTime());
    const idea = state.ideas.find(i => i.id === 'CF-101')!;
    idea.title = '<script>alert("x")</script> Fox';
    state.contributors[0]!.name = '<img src=x onerror=alert(1)>';
    const html = renderPublicSite(buildPublicBoard(state, now));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Fox');
    expect(html).toContain("default-src 'none'");
    expect(escapeHtml(`'&`)).toBe('&#39;&amp;');
  });

  it('deploys the board folder from main with the minimum Pages permissions', () => {
    const yaml = pagesWorkflow('vault/CoForge/Public');
    expect(yaml.startsWith(WORKFLOW_MARKER)).toBe(true);
    expect(yaml).toContain('branches: ["main"]');
    expect(yaml).toContain('- "vault/CoForge/Public/**"');
    expect(yaml).toContain('path: "vault/CoForge/Public"');
    expect(yaml).toContain('pages: write');
    expect(yaml).not.toContain('contents: write');
  });

  it('writes the site into the vault folder and leaves unchanged boards untouched', async () => {
    const app = new App();
    const kit = createTestApp({ app, files: { 'Welcome.md': '# Hello\n' }, layoutReady: true });
    const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
    const publisher = new PublicSitePublisher(plugin);
    const state = createSeed(now.getTime());
    expect(await publisher.publish(state, 'CoForge/Public')).toEqual({ folder: 'CoForge/Public', changed: true });
    const first = kit.read('CoForge/Public/board.json');
    expect(kit.read('CoForge/Public/index.html')).toContain('Mosslight');
    expect(kit.read('CoForge/Public/styles.css')).toContain('.board');
    expect(await publisher.publish(state, 'CoForge/Public')).toEqual({ folder: 'CoForge/Public', changed: false });
    expect(kit.read('CoForge/Public/board.json')).toBe(first);
    state.ideas.find(i => i.id === 'CF-101')!.voters.push('simulator:new-viewer');
    expect((await publisher.publish(state, 'CoForge/Public')).changed).toBe(true);
    expect(kit.read('Welcome.md')).toBe('# Hello\n');
  });
});
