## Summary

Add Sessions to private Idea cards so an operator can inspect current and previous parent attempts, select observed native assistants, and read a live Peek of sanitized messages, tool activity and verification output. Opening or closing an inspector never dispatches, resumes, sends input to or takes over an agent.

Windows desktop adds an explicit read-only terminal follower of the same parent feed. It uses a fixed observer, no SDK credentials/provider input, bounded private files, verified cleanup and conservative uncertain-launch handling. Other platforms use Peek. Captured native execution permissions, authentication, model selection, result validation and final human review remain unchanged.

## Requirements and traceability

Owner approval recorded in BRIEF.md. The scaffold declares no req-* or vi-* obligations. Dedicated provider, engineering and UX agents implemented and cross-reviewed the flow. Plan: docs/project-tasks/2026-11-01-card-agent-sessions.md. Operator guide: docs/coforge/AGENT-SESSIONS.md.

## Validation

- Behavioral red/green tests cover bounded trace ordering/retention, capture before parent completion, persistence/reload, observer failure isolation, child provenance, redaction before clipping, explicit message truncation, parent-only terminal payloads, follow/pause/unread/focus, project isolation, private feed exclusion and lifecycle cleanup.
- Provider integration: 55 focused tests passed; final privacy/truncation follow-up 36 passed. Installed Claude 2.1.281 and Codex 0.145.0 were exercised against local fixture APIs, with live observations before CLI close and unchanged structured results. Recorded Claude child-stream replay also passed. No paid inference or real credentials were used for these canaries.
- Terminal/worker focused batch: 24 passed; final terminal suite: 9 passed. Genuine Windows visible-terminal fixture proved live updates, observer exit and feed removal. Only the owned synthetic window was captured.
- Final UI-focused batch: 7 passed. Contained Sessions spec: 1 passed (16.25s), eight parent/child captures reviewed at 1440/760 in light/dark; strict 1px Resume, keyboard focus, literal HTML, no host errors and exact note bytes. Fixture is explicitly synthetic historical evidence; live provider/terminal behavior is qualified separately.
- npm run test:ui-quality: 8 passed. npm run ui:gallery: 40 captures reviewed, zero capture failures. Impeccable detector: no findings.
- npm run -s dev:obsidian -- --json --port 9334: passed, pinned Obsidian 1.14.4 / launcher 3.2.1, loaded/enabled, errors: [], hostErrorCount: 0, pluginConsole: []. Screenshot and debug report inspected; contained host stopped.
- Typecheck, explicit-config changed-source ESLint (67 files), whole-source lint (2,192 files) and diff checks passed. Final full local aggregate and final-head GitHub qualification are still running and will be recorded here before merge.

## Review findings resolved

Actual native keyboard scrolling competed with Resume; a stable focusable toggle and bounded frame settling fixed the behavior without weakening the end-position assertion. New user scrolling still pauses immediately.

Private terminal roots are excluded from file tools and verification snapshots even under a broad project root. Normalization and credential/path redaction precede display clipping, including command labels and line-wrapped bearer tokens. Requested foreign delegation targets are not presented as observed children. Verbose Claude framing retains a bounded root result without persisting raw transcripts or changing the legacy result/cost parsers. Observation and observer-launch failures never quarantine an AgentJob or replay work.

## Evidence and limits

Ignored evidence: reports/card-agent-sessions/, reports/card-sessions-dev-loop/, reports/obsidian/, reports/ui-gallery/ and contained .nq/ CLI fixtures. No generated reports, credentials, private feeds, dist or native caches are committed. No dependencies were added.

Terminal follow currently supports Windows desktop; it is an observer console, not interactive CLI attachment. Child details depend on provider-emitted evidence; Claude tool-linked identities and unavailable Codex details are disclosed. Existing workers/historical attempts without capture are not reconstructed from SDK databases or global rollouts. Live Peek is a partial bounded feed; authoritative verification evidence and human review remain required.

Local Node is 24.20.0; GitHub uses pinned 24.21.0. Local Docker execution was not run. The mandatory real Linux Docker suite adds a test that checks the container is still running when sanitized output arrives. No actual CF-133/CF-135 execution, personal vault, agent input, release or automatic code acceptance occurred.
