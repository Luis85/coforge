# Service Design

Each project owns one canonical Service Blueprint. Ordered journey-step notes
organize five layers: evidence, customer actions, frontstage actions, backstage
actions and support processes. Actors/roles, touchpoints/channels, systems, pain
points and opportunities can be linked across steps within that blueprint.

`domain/blueprint.ts` declares the typed note model and graph invariants.
`application/service-design.ts` validates project ownership, captures editor inputs,
rejects stale versions and serializes reads and mutations. It has no framework or
host imports; storage and project identity are injected contracts.

The vault adapter lives at `src/plugin/infrastructure/coforge/vault-service-design.ts`.
It writes one frontmatter-plus-Markdown note per entity under a configurable root,
defaulting to `CoForge/Service Design/<project-id>/<entity-id>.md`. IDs and relationship
IDs are canonical; derived `blueprint`, `step` and `related` properties are Obsidian
wikilinks. Unknown frontmatter properties and authored body bytes survive metadata
edits. Exact previous-content checks inside `Vault.process()` prevent lost updates.

Changing the root affects new notes only. Plugin-private configuration retains
previous roots for discovery and public-export exclusion. Each configured root gets
local Git ignore protection before notes are created. Existing tracked files still
require the vault owner's normal Git review; CoForge never rewrites Git history.

Behavioral tests are in `src/plugin/tests/project/coforge/service-design.test.ts` and
`vault-service-design.test.ts`; UI and contained-host coverage live alongside them.
