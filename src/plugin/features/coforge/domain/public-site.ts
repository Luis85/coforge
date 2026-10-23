import type { PublicBoard, PublicContributor, PublicIdea } from './public-board';

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
          <p>${e(idea.plan.summary)}</p>
          <ol>${idea.plan.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol>
        </details>` : '';
  return `
      <article class="card" aria-labelledby="${e(idea.id)}-title">
        <header><span class="id">${e(idea.id)}</span><span class="category ${categoryClass(idea.category)}">${e(idea.category)}</span></header>
        <h3 id="${e(idea.id)}-title">${e(idea.title)}</h3>
        <p class="description">${e(idea.description)}</p>${plan}
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

/** A complete, script-free page. It refreshes itself so a stream overlay picks up new deployments. */
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
  <meta http-equiv="refresh" content="120">
  <meta name="referrer" content="no-referrer">
  <title>${e(board.project)} · Community board</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-header">
    <p class="eyebrow">Built with our community</p>
    <h1>${e(board.project)}</h1>
    <p>Suggest ideas in chat with <code>!request your idea</code> and support them with <code>!vote CF-101</code>.
      Updated <time datetime="${e(board.generatedAt)}">${e(updated.toUTCString())}</time>.</p>
    ${board.awaitingScreening ? `<p class="notice">${e(board.awaitingScreening)} new ${board.awaitingScreening === 1 ? 'request is' : 'requests are'} waiting for screening.</p>` : ''}
  </header>
  <main>
    <h2 class="section-title">Idea board</h2>
    <div class="board">${columns}
    </div>
    <h2 class="section-title">Leaderboards</h2>
    <div class="leaderboards">${leaderboard('Most supported ideas', board.leaderboards.votes, p => p.votesReceived, 'votes received')}${leaderboard('Idea makers', board.leaderboards.ideas, p => p.ideas, 'screened ideas')}${leaderboard('Co-creators', board.leaderboards.implementations, p => p.implementations, 'accepted builds')}
    </div>
    <h2 class="section-title">Badges</h2>
    ${board.contributors.length ? `<ul class="badge-list">${board.contributors.map(badges).join('')}</ul>` : '<p class="empty">No badges earned yet.</p>'}
  </main>
  <footer class="site-footer"><p>Read-only view generated by CoForge. Votes and requests happen in the stream chat.</p></footer>
</body>
</html>
`;
}
