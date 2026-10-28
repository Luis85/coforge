import {
  escapeHtml,
  renderPublicSite,
} from "../../features/coforge/domain/public-site";
import type { PublicBoard } from "../../features/coforge/domain/public-board";

/** Exact compatibility with the shipped de7cb61 renderer, never a fuzzy ownership guess. */
export function renderLegacyPublicSite(board: PublicBoard): string {
  const e = escapeHtml;
  const header = `  <header class="site-header">
    <p class="eyebrow">Built with our community</p>
    <h1>${e(board.project)}</h1>
    <p>Project <strong>${e(board.projectId)}</strong>. Suggest ideas in chat with <code>!request ${e(board.projectId)} your idea</code> and support them with <code>!vote CF-101</code>.
      Updated <time datetime="${e(board.generatedAt)}">${e(new Date(board.generatedAt).toUTCString())}</time>.</p>
    ${board.awaitingScreening ? `<p class="notice">${e(board.awaitingScreening)} new ${board.awaitingScreening === 1 ? "request is" : "requests are"} waiting for screening.</p>` : ""}
  </header>`;
  return renderPublicSite(board)
    .replace(
      '  <meta name="referrer"',
      '  <meta http-equiv="refresh" content="120">\n  <meta name="referrer"',
    )
    .replace(
      /  <header class="site-header">[\s\S]*?  <\/header>/u,
      () => header,
    )
    .replaceAll('class="section-title" id="requests"', 'class="section-title"')
    .replaceAll(
      'class="section-title" id="leaderboards"',
      'class="section-title"',
    )
    .replaceAll(
      'class="section-title" id="recognition"',
      'class="section-title"',
    );
}
