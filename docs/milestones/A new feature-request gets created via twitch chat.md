---
pbl-id: 19
type: Milestone
order: -1000
---

## Acceptance journey

1. The streamer connects Twitch, opts into chatbot replies, and adds a project with a readable ID.
2. A viewer discovers the project with `!projects` and submits `!request CFP-001 Add a lantern`.
3. CoForge saves one canonical Markdown request with the project parent and queues one acknowledgement.
4. Twitch confirms the bot reply with the request ID. Redelivery creates no duplicate note or reply.
5. `!bug CFP-001 The gate crashes` follows the same journey and retains its bug classification.

Automated protocol, storage and UI checks support this journey. Streamer-operated live-channel acceptance
is still required before marking this milestone complete.
