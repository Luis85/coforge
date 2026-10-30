/** Stylesheet of the public viewer page. It runs on GitHub Pages, outside Obsidian, so it carries its own palette. */
export const PUBLIC_SITE_CSS = `:root {
  color-scheme: dark light;
  --bg: #18181c; --surface: #222227; --raised: #2a2a31; --border: #35353e; --text: #f3f1ee; --muted: #aaa8b4;
  --accent: #ff977b; --green: #9ac8ab; --purple: #b3a1e5; --orange: #efbd8b; --yellow: #e1bf70; --blue: #b1c7e9;
  --pink: #e6a8b4; --cyan: #9ac8c2; --red: #f2a1a5;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: light) {
  :root { --bg: #f7f5f2; --surface: #ffffff; --raised: #f0ece7; --border: #ded9d2; --text: #211d1a; --muted: #6a6560;
    --accent: #9c3f24; --green: #24633e; --purple: #594093; --orange: #84420c; --yellow: #6d5306; --blue: #284c81;
    --pink: #8b2c45; --cyan: #1d5d55; --red: #972d35; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-size: 15px; line-height: 1.55; }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.92em; color: var(--accent); }
h1, h2, h3, p { margin: 0; }
.site-header, main, .site-footer { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
.site-header { padding-top: 40px; padding-bottom: 24px; display: grid; gap: 10px; }
.project-id strong { color: var(--text); font-variant-numeric: tabular-nums; }
.updated { font-size: 12px; }
a { color: var(--accent); text-underline-offset: 0.2em; }
a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
::selection { color: var(--bg); background: var(--accent); }
.site-header nav { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-top: 14px; padding-block: 18px; border-block: 1px solid var(--border); }
.site-header nav a { font-size: 14px; font-weight: 700; }
.site-header h1 { font-size: clamp(30px, 5vw, 48px); letter-spacing: -0.03em; line-height: 1.1; }
.site-header p { color: var(--muted); max-width: 70ch; }
.notice { color: var(--orange) !important; }
.section-title { font-size: 22px; margin: 32px 0 16px; letter-spacing: -0.01em; }
.board { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; align-items: start; }
.column { min-width: 0; padding: 0; display: grid; gap: 14px; }
.column h2 { font-size: 18px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 12px; border-bottom: 2px solid var(--border); }
.count { font-size: 12px; color: var(--muted); background: var(--raised); border-radius: 999px; padding: 1px 8px; }
.hint { color: var(--muted); font-size: 12px; margin-top: -8px; }
.column-progress h2 { color: var(--purple); }
.column-done h2 { color: var(--green); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; display: grid; gap: 10px; }
.card header, .card footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.card header { justify-content: space-between; }
.card h3 { font-size: 17px; line-height: 1.4; overflow-wrap: anywhere; }
.description { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.id { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.category { border-radius: 6px; padding: 1px 7px; background: var(--surface); }
.cat-gameplay { color: var(--green); } .cat-world { color: var(--blue); } .cat-qualityoflife { color: var(--yellow); }
.cat-artaudio { color: var(--pink); } .cat-community { color: var(--orange); }
.author { margin-right: auto; overflow-wrap: anywhere; }
.status { color: var(--text); }
.rice { color: var(--purple); }
.votes { color: var(--accent); font-weight: 700; }
.plan { font-size: 13px; border-top: 1px solid var(--border); padding-top: 8px; }
.plan summary { cursor: pointer; color: var(--purple); }
.plan p, .plan ol { margin: 6px 0 0; color: var(--muted); }
.plan ol { padding-left: 20px; }
.empty { color: var(--muted); font-size: 13px; }
.leaderboards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.leaderboard { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
.leaderboard h3 { font-size: 15px; margin-bottom: 10px; }
.leaderboard ol, .badge-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.leaderboard li, .badge-list li { display: flex; align-items: center; gap: 10px; }
.rank { width: 22px; color: var(--muted); font-variant-numeric: tabular-nums; }
.leaderboard li:nth-child(1) .rank { color: var(--yellow); font-weight: 700; }
.name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.metric { font-weight: 700; font-variant-numeric: tabular-nums; }
.metric small { color: var(--muted); font-weight: 400; }
.avatar { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; background: var(--raised); flex-shrink: 0; }
.c-purple { color: var(--purple); } .c-orange { color: var(--orange); } .c-green { color: var(--green); } .c-yellow { color: var(--yellow); }
.c-blue { color: var(--blue); } .c-pink { color: var(--pink); } .c-cyan { color: var(--cyan); } .c-red { color: var(--red); }
.badge-list li { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
.badge-list .name { flex: 0 1 auto; font-weight: 600; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { font-size: 12px; border-radius: 999px; padding: 2px 10px; background: var(--raised); color: var(--green); border: 1px solid var(--border); }
.site-footer { padding-top: 32px; padding-bottom: 40px; color: var(--muted); font-size: 13px; }
.cf-markdown { overflow-wrap: anywhere; line-height: 1.7; }
.cf-markdown p + p { margin-top: 0.8em; }
.cf-markdown :is(h1,h2,h3,h4,h5,h6) { font-size: 1.05em; margin-block: 1em 0.5em; }
.cf-markdown pre { max-width: 100%; overflow-x: auto; padding: 12px; background: var(--raised); }
.cf-markdown :is(th,td) { border: 1px solid var(--border); padding: 6px 8px; text-align: left; }
.cf-markdown-table { max-width: 100%; overflow-x: auto; }
@media (max-width: 1100px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .board, .leaderboards { grid-template-columns: minmax(0, 1fr); } }
`;
