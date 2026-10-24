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
    --accent: #c4502f; --green: #2f7a4f; --purple: #6a4fb3; --orange: #a35a14; --yellow: #8a6a10; --blue: #335f9e;
    --pink: #a83a55; --cyan: #24716a; --red: #b3363e; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-size: 15px; line-height: 1.55; }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.92em; color: var(--accent); }
h1, h2, h3, p { margin: 0; }
.site-header, main, .site-footer { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
.site-header { padding-top: 40px; padding-bottom: 24px; display: grid; gap: 10px; }
.eyebrow { color: var(--accent); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; }
.site-header h1 { font-size: clamp(30px, 5vw, 48px); letter-spacing: -0.03em; line-height: 1.1; }
.site-header p { color: var(--muted); max-width: 70ch; }
.notice { color: var(--orange) !important; }
.section-title { font-size: 22px; margin: 32px 0 16px; letter-spacing: -0.01em; }
.board { display: grid; grid-template-columns: repeat(4, minmax(240px, 1fr)); gap: 16px; align-items: start; }
.column { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px; display: grid; gap: 12px; }
.column h2 { font-size: 16px; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; color: var(--muted); background: var(--raised); border-radius: 999px; padding: 1px 8px; }
.hint { color: var(--muted); font-size: 12px; margin-top: -8px; }
.column-progress h2 { color: var(--purple); }
.column-done h2 { color: var(--green); }
.card { background: var(--raised); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; display: grid; gap: 8px; }
.card header, .card footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.card header { justify-content: space-between; }
.card h3 { font-size: 15px; line-height: 1.35; overflow-wrap: anywhere; }
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
@media (max-width: 1100px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .board, .leaderboards { grid-template-columns: minmax(0, 1fr); } }
`;
