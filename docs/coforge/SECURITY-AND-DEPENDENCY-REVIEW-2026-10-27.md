# Security and dependency review — 2026-10-27

## GitGuardian

The superseded, closed PR #12 had two Generic Password findings in commit `08872fe`:

- [Incident 39151698](https://dashboard.gitguardian.com/workspace/172335/incidents/39151698): a configuration-field
  list in `use-broadcast.ts`, not an assigned credential. The implementation now iterates typed configuration data.
- [Incident 39151697](https://dashboard.gitguardian.com/workspace/172335/incidents/39151697): public OBS authentication
  example salt/challenge data in a deterministic protocol test, not credentials for an actual OBS instance.
  The test now uses clearly synthetic, short fixture values with an independently calculated SHA256 result.

No actual credential was identified in either finding. The merged PR #13 final head `b7860ae` passed GitGuardian:
“3 commits were scanned without uncovering any secrets.” No scanner exclusions or disabled checks were added.
The original failed check is historical evidence and is not changed by a later clean PR. Dashboard incident
closure is an independent action; its current account-side state could not be verified because the browser
tool could not open the dashboard in this session. Those historical occurrences can be classified as false
positives in GitGuardian; this report does not claim they have been closed there.

OBS and Twitch credentials continue to use Obsidian secret storage. Detection reports only whether an OBS
password exists. Installation paths stay in private runtime/UI configuration and never enter operation logs.

## Dependabot

- [#15](https://github.com/Luis85/coforge/pull/15): Fallow 3.35.0, merged after code/build, browser, contained Obsidian and GitGuardian checks.
- [#16](https://github.com/Luis85/coforge/pull/16): postcss-selector-parser 7.1.7, merged after the same checks.
- [#17](https://github.com/Luis85/coforge/pull/17): Lucide icon data 1.2.147, merged after the same checks.
- [#14](https://github.com/Luis85/coforge/pull/14): TypeScript 7.0.2 deferred and closed. CI's exact `npm ci` fails
  with ERESOLVE because typescript-eslint 8.72.0 requires TypeScript `>=4.8.4 <6.1.0`. Registry verification of
  the latest typescript-eslint 8.72.1 found the same peer range. Keep TypeScript 6.0.3 until a supported coordinated
  compiler/linter upgrade is available. No force install, legacy-peer bypass, peer override or weakened test was used.

The dependency versions were incorporated into the guided-setup branch and installed with `npm ci` for
combined verification. There are no remaining PRs from this reviewed set awaiting a decision.
