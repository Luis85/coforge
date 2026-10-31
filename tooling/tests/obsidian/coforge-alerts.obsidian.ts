import { expect as browserExpect, chromium, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

// One black VP9 frame generated with ffmpeg lavfi; no third-party media or network fixture.
const webm = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAH9EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEzTbuMU6uEHFO7a1OsggHn7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjMuMS4xMDFXQYxMYXZmNjMuMS4xMDFEiYhAj0AAAAAAABZUrmvYrgEAAAAAAABP14EBc8WICCvzGdk6T8+cgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4Q7msoA4JGwggFAuoG0moECVbCEVbmBAVXugQDsAQAAAAAAAAIAABJUw2f+c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2My4xLjEwMXNz2WPAi2PFiAgr8xnZOk/PZ8ikRaOHRU5DT0RFUkSHl0xhdmM2My4xLjEwMSBsaWJ2cHgtdnA5Z8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMS4wMDAwMDAwMDAAH0O2dazngQCjp4EAAICCSYNCABPwCzYAOCQcGEoAAFBh9jAAAGcamoSd3Fqbrt9NEBxTu2uRu4+zgQC3iveBAfGCAbbwgQM=';

async function assertSourceGeometry(source: Page, text: string) {
  await expect.poll(() => source.evaluate(() => {
    const paragraph = document.querySelector('.cue p'); const copy = document.querySelector('.copy');
    if (!(paragraph instanceof HTMLElement) || !(copy instanceof HTMLElement)) return false;
    const nodes = ['.cue', '.copy', '.cue p', '.cue img', '.cue video'].map(selector => document.querySelector(selector));
    return paragraph.scrollHeight <= copy.clientHeight + 1 && paragraph.scrollWidth <= copy.clientWidth + 1 && nodes.every(node => {
      if (!(node instanceof HTMLElement)) return false;
      const box = node.getBoundingClientRect();
      return box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
    });
  })).toBe(true);
  expect(await source.locator('.cue p').textContent()).toBe(text);
}

function silentWav(): number[] {
  const data = Buffer.alloc(44 + 8000);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(8000, 28); data.writeUInt16LE(1, 32); data.writeUInt16LE(8, 34);
  data.write('data', 36); data.writeUInt32LE(8000, 40); data.fill(128, 44);
  return [...data];
}

describe('Alerts in the contained native studio', () => {
  test('fires a saved alert into its public browser source and preserves the URL after reload', async ({ obsidian }) => {
    await obsidian.eval(async ({ app }, media) => {
      for (const folder of ['CoForge', 'CoForge/Alerts']) if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      await app.vault.createBinary('CoForge/Alerts/test.gif', new Uint8Array(media.image).buffer);
      await app.vault.createBinary('CoForge/Alerts/test.wav', new Uint8Array(media.audio).buffer);
      await app.vault.createBinary('CoForge/Alerts/test.webm', new Uint8Array(media.video).buffer);
    }, { image: [...Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')], audio: silentWav(), video: [...Buffer.from(webm, 'base64')] });
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'Alerts', exact: true }).click();
    await browserExpect(view.getByLabel('Alerts URL', { exact: true })).toBeVisible();
    const url = await view.getByLabel('Alerts URL', { exact: true }).inputValue();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/alerts\/[a-f0-9]{64}\/$/);
    await view.getByRole('button', { name: 'New alert', exact: true }).click();
    await browserExpect(view.getByLabel('Alert name', { exact: true })).toBeFocused();
    const realm = await obsidian.eval(() => {
      const frame = document.createElement('iframe'); document.body.append(frame);
      try {
        const foreign = frame.contentDocument?.createElement('input'); const input = document.querySelector('.cf-alerts-template input[maxlength="100"]');
        if (!foreign || !input) throw new Error('Foreign-window input is unavailable');
        foreign.value = 'Foreign realm name';
        const event = new Event('input', { bubbles: true }); Object.defineProperty(event, 'target', { value: foreign }); input.dispatchEvent(event);
        return { differentRealm: !(foreign instanceof HTMLInputElement) };
      } finally { frame.remove(); }
    });
    expect(realm.differentRealm).toBe(true); await browserExpect(view.getByLabel('Alert name', { exact: true })).toHaveValue('Foreign realm name');
    await view.getByLabel('Alert name', { exact: true }).fill('  Contained welcome  ');
    await view.getByLabel(/^Text template/).fill('Welcome {{viewer}}!');
    await view.getByLabel(/^Duration \(seconds\)/).fill('30');
    await view.getByLabel(/^Image or GIF/).fill('CoForge/Alerts/test.gif');
    await view.getByLabel(/^Audio/).fill('CoForge/Alerts/test.wav');
    await view.getByRole('button', { name: 'Save alert', exact: true }).click();
    await browserExpect(view.getByRole('status', { name: 'Alert action result' })).toContainText('Alert saved');
    await browserExpect(view.getByRole('status', { name: 'Browser source connection' })).toContainText('No browser source connected');
    await browserExpect(view.getByRole('button', { name: 'Fire alert to OBS', exact: true })).toBeDisabled();
    await view.getByLabel('viewer', { exact: true }).fill('<b>Ada</b>');
    const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const source = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const failures: string[] = []; source.on('pageerror', error => failures.push(error.message));
    try {
      let connected = false;
      source.on('response', response => { if (response.url() === url + 'events') connected = true; });
      await source.goto(url); await expect.poll(() => connected).toBe(true);
      await browserExpect(view.getByRole('status', { name: 'Browser source connection' })).toContainText('1 browser source connected');
      await view.getByRole('button', { name: 'Fire alert to OBS', exact: true }).click();
      await browserExpect(source.locator('#alert')).toHaveText('Welcome <b>Ada</b>!');
      await browserExpect(source.locator('#alert b')).toHaveCount(0);
      await expect.poll(() => source.locator('#alert img').evaluate(element => element instanceof HTMLImageElement && element.naturalWidth > 0)).toBe(true);
      await expect.poll(() => source.locator('#alert audio').evaluate(element => element instanceof HTMLAudioElement && element.readyState >= 2 && element.played.length > 0)).toBe(true);
      expect(await source.locator('#alert audio').evaluate(element => element instanceof HTMLAudioElement ? element.volume : -1)).toBe(0.7);
      await browserExpect(source.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await source.screenshot({ path: `${obsidian.directory}/public-alert.png`, omitBackground: true });
      await view.getByRole('button', { name: 'Stop all alerts', exact: true }).click();
      await browserExpect(source.locator('#alert')).toBeEmpty();
      await browserExpect(source.locator('audio,video')).toHaveCount(0);
      for (const [theme, width] of [['light', 1600], ['dark', 700]] as const) {
        await obsidian.page.setViewportSize({ width, height: 1000 });
        await obsidian.eval((_context, theme) => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
        await browserExpect(view.locator('.cf-alerts-page iframe, .cf-alerts-page frame')).toHaveCount(0);
        // Electron CDP cannot create axe's aggregation tab. Deque's supported same-page mode
        // covers this frame-free Alerts subtree with the identical WCAG rules and assertions.
        // https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/error-handling.md
        const issues = await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('.cf-alerts-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(issues.violations).toEqual([]);
        await obsidian.screenshot(`alerts-${theme}`);
      }
      await obsidian.page.setViewportSize({ width: 1600, height: 1000 });
      await obsidian.reloadPlugin();
      view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
      await view.getByRole('button', { name: 'Alerts', exact: true }).click();
      await browserExpect(view.getByLabel('Alerts URL', { exact: true })).toHaveValue(url);
      await browserExpect(view.getByRole('button', { name: /Contained welcome/ })).toBeVisible();
      connected = false; await source.reload(); await expect.poll(() => connected).toBe(true);
      await browserExpect(source.locator('#alert')).toBeEmpty();
      await browserExpect(view.getByRole('button', { name: 'Fire alert to OBS', exact: true })).toBeEnabled();
      await view.getByLabel('viewer', { exact: true }).fill('Future viewer');
      await view.getByRole('button', { name: 'Fire alert to OBS', exact: true }).click();
      await browserExpect(source.locator('#alert')).toHaveText('Welcome Future viewer!');
      await view.getByRole('button', { name: 'Stop all alerts', exact: true }).click();
      await browserExpect(source.locator('#alert')).toBeEmpty();
      await view.getByText('Edit alert', { exact: true }).click();
      await view.getByLabel('Text template', { exact: true }).fill('{{viewer}}'.repeat(8));
      await view.getByLabel('Video', { exact: true }).fill('CoForge/Alerts/test.webm');
      await view.getByRole('button', { name: 'Save alert', exact: true }).click();
      await view.getByLabel('viewer', { exact: true }).fill('L'.repeat(500));
      await view.getByRole('button', { name: 'Fire alert to OBS', exact: true }).click();
      await expect.poll(() => source.locator('.cue video').evaluate(element => element instanceof HTMLVideoElement && element.readyState >= 2)).toBe(true);
      for (const [width, height] of [[1280, 720], [360, 240]]) {
        await source.setViewportSize({ width, height }); await assertSourceGeometry(source, 'L'.repeat(4000));
        await source.screenshot({ path: `${obsidian.directory}/combined-media-${width}.png`, omitBackground: true });
      }
      await view.getByRole('button', { name: 'Stop all alerts', exact: true }).click();
      await view.getByText('Edit alert', { exact: true }).click();
      const lines = 'Line\n'.repeat(300);
      await view.getByLabel('Text template', { exact: true }).fill(lines);
      await view.getByRole('button', { name: 'Save alert', exact: true }).click();
      await view.getByRole('button', { name: 'Fire alert to OBS', exact: true }).click();
      for (const [width, height] of [[1280, 720], [360, 240]]) { await source.setViewportSize({ width, height }); await assertSourceGeometry(source, lines); }
      await view.getByRole('button', { name: 'Stop all alerts', exact: true }).click();
      await obsidian.eval(() => { document.body.classList.remove('theme-dark'); document.body.classList.add('theme-light'); });
      await view.getByText('Edit alert', { exact: true }).click();
      await view.getByLabel('Text template', { exact: true }).fill('{{viewer}}');
      await view.getByLabel('CoForge event', { exact: true }).selectOption('stream-started');
      await view.getByLabel('Enable automatic dispatch for this event', { exact: true }).check();
      await browserExpect(view.getByRole('alert')).toContainText('cannot supply: viewer');
      await browserExpect(view.getByRole('button', { name: 'Save alert', exact: true })).toBeDisabled();
      await browserExpect(view.locator('.cf-alerts-page iframe, .cf-alerts-page frame')).toHaveCount(0);
      for (const theme of ['light', 'dark']) {
        await obsidian.page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
        const editorIssues = await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('.cf-alerts-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(editorIssues.violations).toEqual([]);
        await obsidian.screenshot(`alerts-editor-invalid-${theme}`);
      }
      expect(failures).toEqual([]); expect(obsidian.errors()).toEqual([]);
      await obsidian.disablePlugin();
      await expect.poll(async () => { try { await fetch(url); return false; } catch { return true; } }).toBe(true);
    } finally { await browser.close(); }
  });
});
