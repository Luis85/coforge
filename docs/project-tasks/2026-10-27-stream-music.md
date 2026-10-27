# Task: Local music library and stream playlists

- Status: in progress
- Traceability: owner request and BRIEF local stream music; generated requirement/interaction arrays are empty.
- Maker preview: music/track scaffolds an unrelated workspace; extend existing CoForge ports and stream studio.

## Acceptance

- Configurable vault-contained MP3 library, same-basename companion notes with license/origin/attribution.
- Explicit refresh; missing/invalid notes and missing playlist tracks are visible; never infer rights.
- Create/edit/reorder/remove playlist entries; save canonical Markdown with optimistic external-edit protection.
- Playback inside Obsidian, queue advances, pause/resume/stop/seek/volume; no startup or go-live autoplay.
- Playback survives view navigation and stops at plugin disposal; late media callbacks cannot restart it.
- No remote audio URLs, source-name logging or shell launch. Show OBS capture guidance.
- Behavioral storage/player tests, UI journeys, contained-host evidence, full checks and review before merge.
