# Task: Make the bucket and step outline readable in Obsidian

- Status: in progress
- Journey: configure Idea board buckets and their ordered steps.
- Traceability: owner screenshot/follow-up; the requirement/interaction scaffold has no entries.

## Problem and direction

The owner's native screenshot shows step numbers/names centered far from their
bucket headings, excessive vertical separation, weak nesting and a truncated
outline. The component needs a compact, consistently left-aligned hierarchy,
clear selection/actions and readable bucket metadata in the actual host.

Keep the saved process, stable identities, explicit save/recovery and execution
behavior. Refine this component within the native Obsidian visual system.

## Acceptance and implementation plan

1. Reproduce the screenshot as a real-Obsidian layout test with eight steps.
   Assert the actual left edges of number/name relative to the row, compact row
   geometry, no overflow, accessible controls and reachable scrolling/tools.
2. Use deliberate bucket headers with inline role/count context, tighter nested
   steps, consistent local indentation and selected actions aligned with content.
   Scope host-button layout resets to this outline so native styles cannot center
   or stretch its rows. Preserve names, accessible descriptions and existing controls.
3. Inspect light/dark and wide/narrow native captures together, repair concrete
   defects, then confirm. Run focused editor/long-list/browser regressions, UI
   quality/gallery, contained host smoke and the complete release gate.
4. Self-review, record real evidence and deliver through the established green-PR
   workflow. Coordinate the shared local install with the durable-build session.

## Evidence

Pending. The prior increment's screenshot/acceptance did not catch the host's
actual content positioning; this increment asserts rendered geometry in Obsidian.

## Untested scope

No workflow execution or persistence behavior is being redesigned.
