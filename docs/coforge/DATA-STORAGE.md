# Vault data storage

CoForge keeps editable Markdown in its configured vault folders. Private JSON and
execution files live at the vault root, independently of plugin installation:

```text
.coforge-data/
  studio/                  Community state, votes, runs and transaction journals
  council/                 Council preferences, intake, links and execution journal
  economy/reservations/    Immutable command/reward draw receipts
  automation/              Schedules, workflow triggers and workspace holds
  integrations/herdr/      Herdr state and unresolved attempts
  integrations/mcp/        MCP registration, connection, bridge and command ledger
  alerts/                  Templates and local endpoint configuration
  streams/                 Per-stream history and private index
  publication/             Public-export ownership receipts
  settings/                Retained Service Design folder configuration
  recovery/                Private recovery evidence
  exports/                 Explicit local exports and diagnostics
  runtime/workers/          Machine-specific worker generations and execution files
```

Atomic JSON backups and temporary generations remain beside their corresponding
record. Worker folders use machine and canonical-vault identity, so a synced copy
cannot silently adopt another machine's process authority. CoForge excludes this
entire tree from Git and from public exports and agent file tools. Include it in
private vault backups along with the editable notes and plugin settings.

The plugin directory contains Obsidian installation assets (`manifest.json`,
`main.js`, `styles.css`) and settings-only `data.json`. Account secrets continue to
use Obsidian secret storage.

On upgrade, private files are preflighted and moved without changing their bytes.
A conflict stops migration and preserves both versions. A failed move can be
retried on reload. Cross-drive worker transfers retain a receipt and verify file
hashes before removing the original bytes; interrupted transfers resume from that
receipt. Worker relocation requires the existing generation-retirement
proofs: completed and acknowledged work, released resources and a stopped original
supervisor. Until these hold, recovery stays attached to the original location and
new Builds are held; settle the original runtime and reload to finish migration.

After migration, persistence checks continue to watch for live journals or stream
history recreated by an older plugin instance. Affected saves stop before changing
the migrated record or note. Preserve both versions, finish unloading the older
plugin and reconcile conflicting records before reloading. Migration removes only
fully marked generated plugin ignore files; unmarked or additional human rules
stay byte-for-byte intact. Generated Git rules normalize Windows separators and
treat spaces and pattern characters in installation paths literally.

Recovery operations retain their visible Markdown staging notes and command
rollback archives under `CoForge/Recovery` while moving/trashing notes through
Obsidian. Receipts and retained deletion copies live in `.coforge-data/recovery`.
This preserves the host's trash preference and recovery behavior.
