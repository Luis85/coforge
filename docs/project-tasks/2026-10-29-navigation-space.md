# Task: Give navigation room and remove redundant project banners

- Status: implemented and verified; delivery tracked in PR #33
- Journey: operate the studio inside an ordinary resizable Obsidian leaf.

## Acceptance

- Expanded navigation is 240px at normal desktop/intermediate leaf widths.
- A 740px-tall desktop leaf fits the complete destination list without scrolling
  or wrapped labels. Smaller heights retain accessible scrolling.
- Project work views have no repeated project-work-context banner. The switcher
  retains active project identity, private visibility and guarded navigation.
- Real project data and execution/privacy boundaries are unaffected.

## Plan and evidence

Start with rendered navigation/absence regressions; adjust the shared spacing and
remove the banner component. Preserve private-project checks at the switcher and
project settings. Review both themes and native narrow/wide panes, then run the
project, browser and native gates. Generated req-* / vi-* obligations are unchanged.

The separately requested local data cleanup uses private backups; no user notes,
project records or backup contents are included in this change.

Validation: verify:project exited 0 (5 check steps passed and artifact verification
passed); focused browser tests 8 passed; UI quality 8 passed; native navigation,
privacy and lifecycle 4 passed. Reviewed gallery (40 screenshots) and both short
navigation themes. The native dev loop reports passed, view opened and no errors.
