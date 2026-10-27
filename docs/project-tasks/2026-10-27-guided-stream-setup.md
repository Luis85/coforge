# Task: Guide a streamer from installation to stream readiness

- Status: in progress
- Journey: first-time OBS and Twitch setup, then explicit Prepare / Go live.
- Traceability: owner request and BRIEF.md; generated requirements/interactions are empty.

## Acceptance

- First use offers a skippable, reopenable guide. Dismissal/completion survive reload.
- Read-only OBS detection distinguishes installed, running, missing and remote configurations.
- Steps use real OBS connection/scenes and Twitch identity, permissions and chat status; saved fields alone do not imply readiness.
- Guide provides installation, WebSocket/password, scenes, Twitch public-app/device authorization and output-review help.
- Real controls save configuration and secrets through existing application/host contracts; failed writes keep drafts.
- Completion needs fresh readiness and explicit review of OBS destination/audio/video. The guide never starts a stream.
- Browser preview cannot detect tools, authorize, launch OBS or change a public channel.
- Events publish after writes; credentials, private paths and raw errors never enter operation metadata.
- Review/resolve every current Dependabot PR; defer unsupported TypeScript 7 rather than bypass peer checks.
- Document the historical GitGuardian false positives and verify the current scanner remains enabled/green.

## Plan

Add failing readiness/detection/persistence tests; implement narrow contracts and discovery reuse; integrate the
guide into Stream studio using existing controls. Verify headless UI and contained Obsidian CI. Run full gates,
review evidence, then merge. Maker preview creates an unrelated note aggregate and view; extend the existing
CoForge application instead of registering a second workspace.

## Limits

No automatic installs, live broadcasts or Twitch writes in agent QA. OBS output credentials stay in OBS;
output review is explicitly human-confirmed, not falsely reported as API-verified. Twitch authorization and
public-app registration require the streamer's browser consent. Historical GitGuardian dashboard incident
state is separate from current repository scans.
