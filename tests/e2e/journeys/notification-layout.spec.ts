import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const theme of ['light', 'dark']) for (const width of [420, 1600]) {
  test(`notification shells keep icons compact and long recovery text readable at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('/#surface=node-1');
    await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
    await page.evaluate(({ theme }) => {
      document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`);
      const root = document.querySelector('.cf-studio');
      if (!root) throw new Error('Missing rendered plugin studio');
      const proof = document.createElement('section'); proof.className = 'cf-notification-proof'; proof.setAttribute('aria-label', 'Notification layout cases');
      Object.assign(proof.style, { position: 'fixed', inset: '12px auto auto 12px', width: 'min(560px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 24px)', overflow: 'auto', padding: '12px', background: 'var(--cf-bg)', zIndex: '200', container: 'plugin-shell-leaf / inline-size' });
      for (const shell of ['cf-idea-alert is-error', 'cf-idea-alert is-agent', 'cf-settings-alert is-error', 'cf-settings-save-message', 'cf-plugin-settings-message is-error', 'cf-toast cf-toast-error']) {
        const notice = document.createElement('div'); notice.className = shell;
        const icon = document.createElement('span'); icon.className = 'cf-icon'; icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/></svg>';
        const body = document.createElement('span'); body.className = 'cf-notice-body'; body.setAttribute('role', 'alert');
        const title = document.createElement('strong'); title.textContent = 'Request needs attention';
        const detail = document.createElement('small'); detail.textContent = `The game repository has uncommitted changes. Commit or stash them before creating a workflow workspace. ${'LongRecoveryReference'.repeat(12)}`;
        body.append(title, detail); notice.append(icon, body);
        if (shell.includes('cf-toast') || shell.includes('cf-plugin-settings-message') || shell.includes('is-agent')) {
          const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = shell.includes('is-agent') ? 'cf-btn cf-btn-ghost cf-idea-small-button' : 'cf-icon-button';
          dismiss.textContent = shell.includes('is-agent') ? 'Cancel run' : '×'; dismiss.setAttribute('aria-label', shell.includes('is-agent') ? 'Cancel run' : 'Dismiss notification'); notice.append(dismiss);
        }
        proof.append(notice);
      }
      root.append(proof);
    }, { theme });
    const notices = page.locator('.cf-notification-proof > div');
    await expect(notices).toHaveCount(6);
    for (const notice of await notices.all()) {
      const box = await notice.evaluate(element => {
        const icon = element.querySelector('.cf-icon')!.getBoundingClientRect();
        const body = element.querySelector('.cf-notice-body')!.getBoundingClientRect();
        const outer = element.getBoundingClientRect();
        return { iconWidth: icon.width, gap: body.left - icon.right, bodyWidth: body.width, width: outer.width,
          clipped: element.scrollWidth > element.clientWidth + 1, bodyOverrun: body.right - outer.right,
          actionWrapped: element.classList.contains('is-agent') ? element.querySelector('button')!.getBoundingClientRect().top >= body.bottom - 1 : true,
          controlsOverrun: [...element.querySelectorAll('button')].some(button => button.getBoundingClientRect().right > outer.right + 1) };
      });
      expect(box.iconWidth).toBeLessThanOrEqual(20); expect(box.gap).toBeGreaterThanOrEqual(0); expect(box.gap).toBeLessThanOrEqual(12);
      expect(box.bodyWidth).toBeGreaterThan(box.width / 2); expect(box.clipped).toBe(false); expect(box.bodyOverrun).toBeLessThanOrEqual(0); expect(box.controlsOverrun).toBe(false);
      if (width === 420) expect(box.actionWrapped).toBe(true);
    }
    await mkdir('reports/notification-polish', { recursive: true });
    await page.locator('.cf-notification-proof').screenshot({ path: `reports/notification-polish/browser-${theme}-${width}.png` });
  });
}
