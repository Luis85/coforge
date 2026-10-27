# Stream statistics

Open **Statistics** in the sidebar, or **View stream statistics** under Stream studio's history panel.
Choose a recorded stream and a metric. Audience/growth leads with viewers, followers and subscribers;
community activity, reply queues, balances, tracked chat presence and OBS health are also available.

The immediately previous eligible stream is selected initially. Add up to three earlier completed streams
from the same channel, and remove them independently. Lines align by elapsed minutes from stream start,
not calendar time; dates are displayed in your local timezone. Shorter streams stop at their last observation.
Different dash patterns and theme colours identify streams. Optional theme colours have safe fallbacks.

Use the **Inspect elapsed minute** slider with a mouse or keyboard, or move over the chart. The readout shows
the nearest actual observation and its recorded time, with no interpolation across gaps. Exact primary-stream
samples are available in a table paginated by 50 observations. Scrollable tables accept keyboard focus.
Long histories use bounded display geometry that preserves bucket extrema and discontinuities; table values
and the inspector always use the original observations.

Null values remain unavailable, while recorded zero stays zero. Missing buckets/measurements break lines.
Growth starts at the first valid observed total. Activity metrics count recorded intervals, which can exceed
one minute after a gap. Community balances/queues are workspace totals or retained records, not platform
analytics. Tracked chat presence is not video watch time. Summary means are arithmetic means of observed
viewers and can be affected by incomplete coverage. Final partial intervals contribute to totals where saved.

**Refresh statistics** rereads the history index and selected files. The current stream reloads when its
recorded summary changes. A failed comparison is omitted with a removal action; a missing/invalid primary
history shows an error instead of retaining another stream's chart. Older asynchronous reads cannot overwrite
new selections. **Export selected stream JSON** uses the existing private export action.

Statistics reads the canonical JSON through the host's validated read contract and never modifies it or requests
new Twitch permissions. Browser preview starts empty and offers an explicit synthetic example; it is labelled,
never saved and cannot be exported as real channel data. Real recordings remain in `CoForge/Streams`.
