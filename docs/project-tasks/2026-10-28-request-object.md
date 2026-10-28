# Project-specific Request Objects

- Status: backend and UI implemented; final integrated/native qualification and merge pending.
- Owner decisions: class is a plain frontmatter label, without class-plugin integration; definitions affect **new requests only**, preserving existing notes.
- Journey: collect structured, project-specific request data while retaining stable identities, canonical Markdown and downstream review.

## Contract

An optional project `Settings.requestObject` defines a class name and optional text, number, date, checkbox or select fields. Fields have stable keys, labels and optional typed defaults. No required fields or new chat syntax are introduced. Reserved request/project/Obsidian names, managed namespaces, duplicate key aliases and prototype properties are rejected.

New requests capture class, field definitions and validated values. The project note owns `request-object-definition`; request notes own `request-class`, `coforge-request-schema` and only the native custom keys listed in their captured schema. The core type remains `coforge-idea`. Legacy notes without a capture retain unrelated properties, including pre-existing class labels. A changed project schema does not rewrite prior requests.

Creation accepts optional `projectId`, `requestValues` and `requestObjectRevision`; old callers retain their behavior. Chat intake remains explicitly project-routed and uses defaults without required custom input. Defaults apply only at creation, so clearing a captured value does not reapply them.

The owner also chose a per-project maintained category list beside this definition. New requests capture that list; chat defaults to its first entry. Names are bounded and unique, with at least one choice. Category-only configuration still creates a capture. Existing notes retain their original category, and board filters combine current choices with historic categories in the selected project. Public projections accept bounded category names without publishing private custom fields.

`updateRequestValues(id, values, expectedRequestFingerprint)` validates captured field types, current request state and project availability. Native guarded edits re-read canonical inputs inside `Vault.process`, preserve exact unrelated frontmatter/body ranges and restore the note if later plugin-data persistence fails. Human input and managed workflow progress participate in the native stale-input precondition; derived status may legitimately differ after integrity quarantine.

Captured data participates in screening heuristics, immutable proposal/integrity revisions and untrusted native/configured/Herdr dispatch payloads. Old results cannot apply after values change. Custom metadata is not added to public projections or used as execution authority.

## Evidence

- Initial domain test could not resolve the missing Request Object module (red).
- Domain/native/creation/dispatch regressions: **3 files / 24 tests passed**, 6.64 seconds. Includes optional defaults, zero/false, reserved keys, schema isolation, exact legacy-note preservation, native reload, captured value edits, stale note rejection, rollback after data-write failure, external-edit quarantine/echo handling, chat routing, private projection and in-flight result rejection.
- Existing canonical project/storage/engine/configured-prompt regression: **4 files / 29 tests passed**, 18.65 seconds.
- Parent UI tests exposed a real reactive-proxy clone failure. Domain settings copying now uses typed definition parsing, with a regression proving independent nested data and no Vue dependency.
- Full typecheck and source gate passed at the latest backend qualification: **2991 inputs / 226 translated keys**. Parent final checks cover subsequent changes.
- Project settings now edits the class, categories, typed fields, defaults and order. New-request intake uses a captured schema/revision, and Request overview edits values against the original schema with per-request draft retention and explicit stale-draft discard.
- Parent category/creation/native/UI regression: **4 files / 12 tests passed**, 7.92 seconds. Subsequent form and Council-recovery polishing: **3 files / 6 tests passed**, 9.43 seconds, including invalid duplicate category draft preservation.
- Browser qualification exposed helper text becoming part of accessible names and multiline lists collapsing a newly typed line. Field names/descriptions are separated; lists normalize on change rather than on each keystroke. A browser journey types a category on a new line to cover this behavior.
- `coforge-request-object.obsidian.ts` adds contained-host configuration, capture, guarded edit, schema isolation across reload and exact human-frontmatter/body preservation. It is pending provisioned CI; local native tooling remains unavailable.
- Final focused browser journey: **2 passed (49.1s)** with twelve captures across configuration, creation and saved values, both themes and 1440/480px leaves. Axe and horizontal-overflow checks pass. It verifies a naturally typed multiline category, numeric zero, value edits and old class/category preservation after a future-definition change.
- Axe identified reorder buttons whose accessible name interrupted the visible words “Move up/down”; names now begin with the complete visible action and append the field number.
- Cleanup draft regression went red, then **2 files / 3 tests passed (3.36s)**: committed removal cutoffs clear only removed example field drafts in each leaf; ordinary missing-note drafts and restored request generations remain preserved.

No migration API was added. Tests use in-memory contained vaults and simulated provider output; live provider calls and personal vaults were not used.
