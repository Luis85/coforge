import type { PublicBoard, PublicContributor, PublicIdea } from './public-board';
import { markdownHtml } from './markdown-html';

/** Every value from the board is untrusted community text and is escaped before it reaches HTML. */
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
const e = escapeHtml;
const categoryClass = (category: string) => `cat-${category.toLowerCase().replace(/[^a-z]/g, '')}`;
const initial = (name: string) => e(name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '?');

function card(idea: PublicIdea): string {
  const plan = idea.plan ? `
        <details class="plan"><summary>Implementation plan</summary>
          <div class="cf-markdown">${markdownHtml(idea.plan.summary)}</div>
          <ol>${idea.plan.steps.map(step => `<li class="cf-markdown">${markdownHtml(step)}</li>`).join('')}</ol>
        </details>` : '';
  return `
      <article class="card" aria-labelledby="${e(idea.id)}-title">
        <header><span class="id">${e(idea.id)}</span><span class="category ${categoryClass(idea.category)}">${e(idea.category)}</span></header>
        <h3 id="${e(idea.id)}-title">${e(idea.title)}</h3>
        <div class="description cf-markdown">${markdownHtml(idea.description)}</div>${idea.contexts?.length ? `<details><summary>Community context (${idea.contexts.length})</summary>${idea.contexts.map(context => `<p><strong>${e(context.author)}</strong></p><div class="cf-markdown">${markdownHtml(context.text)}</div>`).join('')}</details>` : ''}${plan}
        <footer>
          <span class="author">by ${e(idea.author)}</span>
          <span class="status">${e(idea.status)}</span>
          ${idea.rice === null ? '' : `<span class="rice" title="RICE score">RICE ${e(idea.rice)}</span>`}
          <span class="votes" title="Unique votes">▲ ${e(idea.votes)}</span>
        </footer>
      </article>`;
}

function leaderboard(title: string, people: PublicContributor[], metric: (person: PublicContributor) => number, unit: string): string {
  const rows = people.map((person, index) => `
          <li><span class="rank">${index + 1}</span><span class="avatar c-${e(person.color)}" aria-hidden="true">${initial(person.name)}</span>
            <span class="name">${e(person.name)}</span><span class="metric">${e(metric(person))} <small>${e(unit)}</small></span></li>`).join('');
  return `
      <section class="leaderboard" aria-labelledby="lb-${e(unit.replace(/\s+/g, '-'))}">
        <h3 id="lb-${e(unit.replace(/\s+/g, '-'))}">${e(title)}</h3>
        ${people.length ? `<ol>${rows}</ol>` : '<p class="empty">No entries yet.</p>'}
      </section>`;
}

function badges(person: PublicContributor): string {
  const earned = person.badges.filter(badge => badge.earned);
  return `
        <li><span class="avatar c-${e(person.color)}" aria-hidden="true">${initial(person.name)}</span><span class="name">${e(person.name)}</span>
          <span class="badges">${earned.map(badge => `<span class="badge" title="${e(badge.description)}">${e(badge.title)}</span>`).join('')}</span></li>`;
}

/** A complete, script-free page. Refresh is explicit so reading and keyboard focus are never interrupted. */
export function renderPublicSite(board: PublicBoard): string {
  const updated = new Date(board.generatedAt);
  const columns = board.columns.map(column => `
    <section class="column column-${e(column.id)}" aria-labelledby="col-${e(column.id)}">
      <h2 id="col-${e(column.id)}">${e(column.title)} <span class="count">${column.ideas.length}</span></h2>
      <p class="hint">${e(column.hint)}</p>
      ${column.ideas.length ? column.ideas.map(card).join('') : '<p class="empty">Nothing here yet.</p>'}
    </section>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
  <title>${e(board.project)} · Community board</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-header">
    <h1>${e(board.project)}</h1>
    <p class="project-id">Community game project <strong>${e(board.projectId)}</strong></p>
    <p>Join with <code>!register</code> in stream chat. Suggest an idea with <code>!request ${e(board.projectId)} your idea</code> and support a request with <code>!vote CF-101</code>.</p>
    <p class="updated">Updated <time datetime="${e(board.generatedAt)}">${e(updated.toUTCString())}</time>. <a href="./">Refresh board</a></p>
    ${board.awaitingScreening ? `<p class="notice">${e(board.awaitingScreening)} new ${board.awaitingScreening === 1 ? 'request is' : 'requests are'} waiting for screening.</p>` : ''}
    <nav aria-label="Viewer board sections"><a href="#requests">Idea board</a><a href="#leaderboards">Leaderboards</a><a href="#recognition">Badges</a></nav>
  </header>
  <main>
    <h2 class="section-title" id="requests">Idea board</h2>
    <div class="board">${columns}
    </div>
    <h2 class="section-title" id="leaderboards">Leaderboards</h2>
    <div class="leaderboards">${leaderboard('Most supported ideas', board.leaderboards.votes, p => p.votesReceived, 'votes received')}${leaderboard('Idea makers', board.leaderboards.ideas, p => p.ideas, 'screened ideas')}${leaderboard('Co-creators', board.leaderboards.implementations, p => p.implementations, 'accepted builds')}
    </div>
    <h2 class="section-title" id="recognition">Badges</h2>
    ${board.contributors.length ? `<ul class="badge-list">${board.contributors.map(badges).join('')}</ul>` : '<p class="empty">No badges earned yet.</p>'}
  </main>
  <footer class="site-footer"><p>Read-only view generated by CoForge. Votes and requests happen in the stream chat.</p></footer>
</body>
</html>
`;
}
