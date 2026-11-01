/** Browser-side WCAG check: Canvas resolves native color-mix and translucent backgrounds. */
export function cardBadgeContrast(badges: Element[]) {
  const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('A 2D color compositor is required.');
  const paint = (color: string) => { context.fillStyle = color; context.fillRect(0, 0, 1, 1); };
  const luminance = (pixel: Uint8ClampedArray) => {
    const channels = Array.from(pixel).slice(0, 3).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const semantic: Record<string, string> = { flagged: '--color-red', agent: '--color-purple', review: '--color-orange', done: '--color-green' };
  return badges.map(badge => {
    const tone = Object.keys(semantic).find(name => badge.classList.contains(`cf-state-${name}`)); if (!tone) throw new Error('A card status must identify its semantic tone.');
    const ancestors: Element[] = []; for (let parent: Element | null = badge; parent; parent = parent.parentElement) ancestors.unshift(parent);
    context.clearRect(0, 0, 1, 1); paint('#ffffff');
    for (const ancestor of ancestors) paint(getComputedStyle(ancestor).backgroundColor);
    const background = context.getImageData(0, 0, 1, 1); const behind = luminance(background.data);
    paint(getComputedStyle(badge).color); const actual = context.getImageData(0, 0, 1, 1);
    context.putImageData(background, 0, 0); paint(getComputedStyle(badge).getPropertyValue(semantic[tone]!).trim());
    const legacy = context.getImageData(0, 0, 1, 1);
    return { tone, ratio: ratio(luminance(actual.data), behind), legacyRatio: ratio(luminance(legacy.data), behind),
      foreground: [...actual.data].slice(0, 3), background: [...background.data].slice(0, 3), legacyForeground: [...legacy.data].slice(0, 3) };
  });
}
