# Task: Revoke private-project data from managed local exports

- Status: implemented; root qualification/review in progress.
- User scope: project visibility is public/private; private projects and their data must not appear in public capture, bot or exported viewer surfaces.

## Contracts and implementation

The domain owner supplies projectIsPublic, public-only request/recognition projections and transient
runtime.publicationDeniedProjectIds. Unknown/unavailable projects fail closed; absent legacy visibility
retains existing public behavior. The Store adds a denial before asynchronous revocation/storage work,
keeps canonical visibility unchanged on failed UI saves, and clears holds only through an explicit public
reconciliation. External canonical private/remove observations are denied before cancellation can fail.

StudioHost.beforeCommit(next, previous|null) enters the publisher's exclusive FIFO lease before writing
project state. The lease remains held through persistence, state/event publication and failure cleanup.
Startup uses the same hook before public sources become ready. Manual and automatic publications use
fresh state inside that lease; automatic target/enabled policy is also re-read inside the queued action.
An old queued snapshot cannot republish a project after its visibility or fail-closed hold changes.

Only board.json and index.html are retired: these are the managed data-bearing output files. Shared
styles, .nojekyll, unrelated files and canonical notes are preserved. Private SHA-256 receipts in
coforge-public-exports.json identify exact owned folders/bytes and the public project IDs used to
produce them. Receipts are persisted before writing public files and accept the prior/planned hashes,
so partial publication failure leaves both versions attributable. All receipt-tracked folders and
verified legacy exports are considered, including old configured destinations.

Known legacy HTML is reconstructed exactly from the actual de7cb61 renderer's former header, refresh
and heading behavior. A static HTML/JSON fixture was generated with that actual source renderer.
Recognition requires a fully valid namespaced public projection and byte equality with a known
renderer, not a filename/footer substring alone. Edited/unverifiable generated artifacts block privacy
precommit and preserve human changes. Foreign files with similar names are left untouched.

Startup does not repeatedly delete exports already generated under the current private policy.
Folder case variants retain their own receipts and valid old/planned hashes. Configuration and Git
internal folders cannot be adopted as public exports. Receipt paths/names/hashes are validated before
retirement; deletion always targets exact owned data filenames, never a recursive folder removal.

syncPublicBoard also observes new publication denials immediately, independently of optional automatic
exports. This closes the external-note case where cancellation fails before any Store transaction starts.
Stopping the synchronizer prevents its already-queued automatic publication from executing later.

## Evidence

- TDD: initial 3 revocation tests failed because PublicSitePublisher.beforeCommit did not exist.
- Targeted final group: **5 files passed, 27 tests passed**. It includes revocation/lease/freshness,
  actual legacy compatibility, human edits, partial export writes, old destinations, startup policy,
  failed visibility persistence, immediate denial with auto-update off, stopped queued updates,
  unrelated filenames, folder case variants, existing public-board and configured/Council folder rules.
- Source gate passed: **2991 inputs, 226 translated keys**, code-line limits and locale parity valid.
- Combined typecheck passed after the parent Request Object literal fix.
- Scoped publisher/runtime/test ESLint and git diff --check passed.
- The domain owner separately qualified privacy, canonical visibility persistence, bot queue/projection
  and failed-save/capture behavior; root retains the combined full-suite/native/browser evidence.

## Limits

This retires managed local export data. Already deployed GitHub Pages content, Git history, manually
copied files and unrelated human documents are outside that local mutation. The streamer must publish
and push a fresh safe export to update the deployed site. No vault commit, push or remote deployment
was performed by this implementation.
