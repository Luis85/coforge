import { expect, test, type Locator } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { polishingCardProofBundle } from '../support/polishing-card-proof-bundle';

let script = '';
test.beforeAll(async () => { script = await polishingCardProofBundle(); });
async function expectAlignedColumns(proof: Locator) {
  const rows = await proof.locator('.cf-kanban-column').evaluateAll(columns => columns.map(column => ({
    id: column.getAttribute('data-bucket-id'), hint: column.querySelector('.cf-column-hint')!.getBoundingClientRect().top,
    cards: column.querySelector('.cf-column-cards')!.getBoundingClientRect().top,
  })));
  expect(rows).toHaveLength(5);
  for (const metric of ['hint', 'cards'] as const) {
    const tops = rows.map(row => row[metric]); expect(Math.max(...tops) - Math.min(...tops), JSON.stringify(rows)).toBeLessThanOrEqual(1);
  }
}
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
for (const [theme, width] of [['light', 360], ['dark', 1440]] as const) {
  test(`polishing card feedback follows independent run state in ${theme} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(theme => { document.body.classList.toggle('theme-dark', theme === 'dark'); document.body.classList.toggle('theme-light', theme === 'light'); }, theme);
    await page.evaluate(script);
    const proof = page.getByRole('region', { name: 'Polishing card presentation proof', exact: true });
    const card = proof.locator('[data-idea-id="CF-901"]'); const badge = card.locator('.cf-card-polishing-state');
    await expect(card).toBeVisible(); await card.scrollIntoViewIfNeeded();
    await expect(proof.getByRole('button', { name: 'Add idea to inbox', exact: true })).toBeVisible();
    await expectAlignedColumns(proof);
    const original = await page.evaluate(() => window.coforgePolishingCardProof?.checkpoint());
    const bucket = await card.evaluate(element => element.closest('[data-bucket-id]')?.getAttribute('data-bucket-id'));
    for (const [phase, label] of [['queued', 'Polishing queued'], ['running', 'Polishing in progress'], ['review', 'Polishing ready for review'], ['attention', 'Polishing needs attention']] as const) {
      await page.evaluate(phase => window.coforgePolishingCardProof?.transition(phase), phase);
      await expect(badge).toHaveText(label); await expect(badge).toHaveAttribute('data-polishing-status', phase);
      if (phase === 'running') {
        const motion = await badge.locator('.cf-spin').evaluate(element => ({ duration: getComputedStyle(element).animationDuration, iterations: getComputedStyle(element).animationIterationCount }));
        expect(Number.parseFloat(motion.duration) * 1000).toBeLessThanOrEqual(0.010001); expect(motion.iterations).toBe('1');
      }
      await expect(card.locator('.cf-card-state').first()).toContainText('Run needs attention');
      expect(await page.evaluate(() => window.coforgePolishingCardProof?.checkpoint())).toBe(original);
      expect(await card.evaluate(element => element.closest('[data-bucket-id]')?.getAttribute('data-bucket-id'))).toBe(bucket);
      expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expectCardWithinTrack(card);
      expect(await proof.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await mkdir('reports/polishing-card-feedback', { recursive: true });
      await card.screenshot({ path: `reports/polishing-card-feedback/${phase}-${theme}-${width}.png` });
      expect((await new AxeBuilder({ page }).include('[data-polishing-card-proof]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations,
        `${phase} polishing state in ${theme} at ${width}px`).toEqual([]);
    }
    for (const phase of ['applied', 'rejected'] as const) {
      await page.evaluate(phase => window.coforgePolishingCardProof?.transition(phase), phase);
      await expect(badge).toHaveCount(0); await expect(card).toBeVisible();
      expect(await page.evaluate(() => window.coforgePolishingCardProof?.checkpoint())).toBe(original);
    }
    await page.evaluate(() => window.coforgePolishingCardProof?.wrapColumns());
    await proof.evaluate(element => element.setAttribute('style', 'zoom: 1.5'));
    await expectAlignedColumns(proof);
    await expectCardWithinTrack(card);
    expect(await proof.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await proof.locator('.cf-kanban').evaluate(element => { element.scrollLeft = 0; });
    await page.locator('[data-polishing-card-proof]').screenshot({ path: `reports/polishing-card-feedback/alignment-wrapped-${theme}-${width}.png` });
    expect(await page.evaluate(() => window.coforgePolishingCardProof?.providerCalls)).toBe(0);
    await page.evaluate(() => window.coforgePolishingCardProof?.destroy());
  });
}
