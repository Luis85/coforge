/** Self-contained browser program: serialized into the public page, with no studio dependencies. */
export function alertsPlayer(): void {
  const output = document.querySelector<HTMLElement>('#alert');
  if (!output) return;
  const queue: Array<{ text: string; image: string; audio: string; video: string; duration: number; volume: number }> = [];
  let timeout: number | undefined;
  let active = false;
  let fitText = () => {};
  const media: Array<HTMLMediaElement> = [];
  // createElementNS returns HTMLElement; these locally-created HTML audio/video tags have native media APIs.
  const isMedia = (element: HTMLElement): element is HTMLMediaElement => element.namespaceURI === 'http://www.w3.org/1999/xhtml' && (element.localName === 'audio' || element.localName === 'video');
  const resized = () => { fitText(); };
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resized);
  observer?.observe(output);
  window.addEventListener('resize', resized);
  function reset(): void {
    window.clearTimeout(timeout); timeout = undefined; queue.length = 0; active = false;
    fitText = () => {};
    for (const item of media) { item.pause(); item.removeAttribute('src'); item.load(); }
    media.length = 0; output?.replaceChildren();
  }
  function next(): void {
    const cue = queue.shift();
    if (!cue || !output) { active = false; return; }
    active = true;
    const card = document.createElementNS('http://www.w3.org/1999/xhtml', 'section'); card.className = 'cue';
    card.classList.toggle('has-visuals', Boolean(cue.image || cue.video));
    const visuals = document.createElementNS('http://www.w3.org/1999/xhtml', 'div'); visuals.className = 'visuals';
    if (cue.image) { const image = new Image(); image.src = cue.image; image.alt = ''; visuals.append(image); }
    const copy = document.createElementNS('http://www.w3.org/1999/xhtml', 'div'); copy.className = 'copy';
    const paragraph = document.createElementNS('http://www.w3.org/1999/xhtml', 'p'); paragraph.textContent = cue.text; copy.append(paragraph);
    for (const kind of ['video', 'audio'] as const) {
      if (!cue[kind]) continue;
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', kind);
      if (!isMedia(element)) continue;
      element.src = cue[kind]; element.volume = cue.volume;
      if (kind === 'video') element.setAttribute('playsinline', '');
      media.push(element);
      if (kind === 'video') visuals.append(element); else card.append(element);
      void element.play().catch(() => { card.dataset.audio = 'blocked'; });
    }
    if (cue.image || cue.video) card.append(visuals);
    if (cue.text) card.append(copy);
    output.replaceChildren(card);
    fitText = () => {
      if (!cue.text || !copy.clientWidth || !copy.clientHeight) return;
      const preferred = Math.min(64, Math.max(24, window.innerWidth * 0.04));
      const fits = () => paragraph.scrollHeight <= copy.clientHeight && paragraph.scrollWidth <= copy.clientWidth;
      paragraph.style.fontSize = `${preferred}px`;
      if (fits()) return;
      let lower = 0.001; let upper = preferred;
      // Fit all supported text without truncation. Root-only observation avoids resize feedback loops.
      for (let step = 0; step < 9; step++) {
        const size = (lower + upper) / 2; paragraph.style.fontSize = `${size}px`;
        if (fits()) lower = size; else upper = size;
      }
      paragraph.style.fontSize = `${lower}px`;
    };
    fitText();
    timeout = window.setTimeout(() => {
      for (const element of media) { element.pause(); element.removeAttribute('src'); element.load(); }
      media.length = 0; output.replaceChildren(); fitText = () => {}; active = false; next();
    }, cue.duration * 1000);
  }
  const source = new EventSource('events');
  source.addEventListener('cue', event => {
    if (queue.length >= 20) return;
    queue.push(JSON.parse(event.data));
    if (!active) next();
  });
  source.addEventListener('clear', reset);
  source.onerror = reset;
  window.addEventListener('pagehide', () => { source.close(); reset(); observer?.disconnect(); window.removeEventListener('resize', resized); });
}

export const alertsHtml = (): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CoForge Alerts</title><link rel="stylesheet" href="player.css"></head>
<body><main id="alert" aria-live="polite"></main><script src="player.js"></script></body></html>`;

export const alertsPlayerCss = `
:root { color-scheme: dark; font-family: system-ui, sans-serif; color: white; background: transparent; }
* { box-sizing: border-box; }
body { margin: 0; background: transparent; overflow: hidden; }
#alert { display: grid; width: 100vw; height: 100vh; place-items: center; padding: 3vmin; }
.cue { display: flex; flex-direction: column; gap: min(1rem, 2vmin); width: 100%; height: 100%; min-width: 0; min-height: 0; text-align: center; }
.visuals { display: flex; flex: 1 1 55%; align-items: center; justify-content: center; gap: 2vmin; min-width: 0; min-height: 0; }
.visuals img, .visuals video { flex: 1 1 0; width: 0; height: 100%; min-width: 0; min-height: 0; object-fit: contain; }
.copy { display: grid; place-items: center; flex: 1 1 auto; min-width: 0; min-height: 0; }
.has-visuals .copy { flex: 0 0 40%; height: 40%; }
.cue p { max-width: 100%; max-height: 100%; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: clamp(24px, 4vw, 64px); font-weight: 700; line-height: 1.2; text-shadow: 0 2px 8px black; }
.cue audio { display: none; }
`;
