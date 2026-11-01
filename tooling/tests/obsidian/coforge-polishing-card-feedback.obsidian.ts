import { describe, expect } from 'vitest';
import { expect as browserExpect, type Locator } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './support/obsidian-fixture';
import { polishingCardProofBundle } from '../../../tests/e2e/support/polishing-card-proof-bundle';

async function expectCardWithinTrack(card: Locator) {
  const bounds = await card.evaluate(element => {
    const column = element.closest('.cf-kanban-column'); if (!column) throw new Error('The card must belong to a Kanban column.');
    const cardBox = element.getBoundingClientRect(); const track = column.getBoundingClientRect();
    const controls = [...element.querySelectorAll('.cf-vote-button, .cf-card-menu-button')].map(control => {
      const box = control.getBoundingClientRect(); return { leftOverflow: cardBox.left - box.left, rightOverflow: box.right - cardBox.right };
    });
    const author = element.querySelector('.cf-idea-author')!.getBoundingClientRect();
    const actions = element.querySelector('.cf-idea-card-numbers')!.getBoundingClientRect();
    const vote = element.querySelector('.cf-vote-button')!.getBoundingClientRect();
    const menu = element.querySelector('.cf-card-menu-button')!.getBoundingClientRect();
    return { widthOverflow: cardBox.width - track.width, leftInset: cardBox.left - track.left, rightOverflow: cardBox.right - track.right,
      controls, authorGap: actions.left - author.right, controlGap: menu.left - vote.right };
  });
  expect(bounds.widthOverflow, JSON.stringify(bounds)).toBeLessThanOrEqual(1);
  expect(bounds.leftInset, JSON.stringify(bounds)).toBeGreaterThanOrEqual(-1);
  expect(bounds.rightOverflow, JSON.stringify(bounds)).toBeLessThanOrEqual(1);
  expect(bounds.controls).toHaveLength(2);
  for (const control of bounds.controls) {
    expect(control.leftOverflow, JSON.stringify(bounds)).toBeLessThanOrEqual(1);
    expect(control.rightOverflow, JSON.stringify(bounds)).toBeLessThanOrEqual(1);
  }
  expect(bounds.authorGap, JSON.stringify(bounds)).toBeGreaterThanOrEqual(-1);
  expect(bounds.controlGap, JSON.stringify(bounds)).toBeGreaterThanOrEqual(-1);
}

describe('Independent polishing feedback on native Kanban cards', () => {
  test('shows progress and review without moving the primary request or starting a provider', async ({ obsidian }) => {
    await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    const script = await polishingCardProofBundle();
    for (const [theme, width] of [['dark', 1440], ['light', 820]] as const) {
      await obsidian.page.setViewportSize({ width, height: 900 });
      await obsidian.eval((_context, theme) => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
      await obsidian.page.evaluate(script);
      const proof = obsidian.page.getByRole('region', { name: 'Polishing card presentation proof', exact: true });
      const card = proof.locator('[data-idea-id="CF-901"]'); const badge = card.locator('.cf-card-polishing-state');
      await browserExpect(card).toBeVisible(); await card.scrollIntoViewIfNeeded();
      const geometry = await proof.locator('.cf-kanban-column').evaluateAll(columns => columns.map(column => ({
        hint: column.querySelector('.cf-column-hint')!.getBoundingClientRect().top,
        cards: column.querySelector('.cf-column-cards')!.getBoundingClientRect().top,
      })));
      expect(geometry).toHaveLength(5);
      for (const metric of ['hint', 'cards'] as const) { const tops = geometry.map(row => row[metric]); expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1); }
      const original = await obsidian.page.evaluate(() => window.coforgePolishingCardProof?.checkpoint());
      const bucket = await card.evaluate(element => element.closest('[data-bucket-id]')?.getAttribute('data-bucket-id'));
      for (const [phase, label] of [['queued', 'Polishing queued'], ['running', 'Polishing in progress'], ['review', 'Polishing ready for review'], ['attention', 'Polishing needs attention']] as const) {
        await obsidian.page.evaluate(phase => window.coforgePolishingCardProof?.transition(phase), phase);
        await browserExpect(badge).toHaveText(label); await browserExpect(card.locator('.cf-card-state').first()).toContainText('Run needs attention');
        expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await expectCardWithinTrack(card);
        expect(await proof.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        expect(await obsidian.page.evaluate(() => window.coforgePolishingCardProof?.checkpoint())).toBe(original);
        expect(await card.evaluate(element => element.closest('[data-bucket-id]')?.getAttribute('data-bucket-id'))).toBe(bucket);
        await obsidian.screenshot(`native-polishing-card-${phase}-${theme}-${width}`);
        expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('[data-polishing-card-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations,
          `${phase} polishing state in ${theme} at ${width}px`).toEqual([]);
      }
      await obsidian.page.evaluate(() => window.coforgePolishingCardProof?.transition('applied'));
      await browserExpect(badge).toHaveCount(0);
      await obsidian.page.evaluate(() => window.coforgePolishingCardProof?.wrapColumns());
      await proof.evaluate(element => element.setAttribute('style', 'zoom: 1.5'));
      const wrapped = await proof.locator('.cf-kanban-column').evaluateAll(columns => columns.map(column => ({
        hint: column.querySelector('.cf-column-hint')!.getBoundingClientRect().top,
        cards: column.querySelector('.cf-column-cards')!.getBoundingClientRect().top,
      })));
      for (const metric of ['hint', 'cards'] as const) { const tops = wrapped.map(row => row[metric]); expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1); }
      await expectCardWithinTrack(card);
      expect(await proof.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await proof.locator('.cf-kanban').evaluate(element => { element.scrollLeft = 0; });
      await obsidian.screenshot(`native-board-alignment-wrapped-${theme}-${width}`);
      expect(await obsidian.page.evaluate(() => window.coforgePolishingCardProof?.providerCalls)).toBe(0);
      await obsidian.page.evaluate(() => window.coforgePolishingCardProof?.destroy());
    }
  });
});
