# Community environment and player management

Open **Community settings** to name community actors (default **Agent**) and the game currency
(default **gold**), configure earning rates, and maintain the named rank ladder. Each rank has a name
and a minimum XP threshold. Include a starting rank at 0 XP; names and thresholds must be unique.
Ranks are sorted by XP when saved. Viewers hold the highest threshold they have reached. Labels and
rank changes preserve balances; earning-rate changes affect future rewards.

## Join and participate

Unregistered Twitch viewers receive a registration prompt on their first observed message, at most
once per 24 hours. Automatic bot messages must be enabled. Twitch chat-message intake does not claim
to detect a passive viewer arriving or prove they are watching video.

`!register` creates one channel-wide player profile, using the stable Twitch account ID. Repeating it
or renaming the Twitch account keeps balances, history and restrictions. Existing contributors keep
their contributions and register explicitly. Registration establishes the CoForge player account;
spawning a character in the external game is a later integration.

Registered viewers use:

- `!projects [page]` to discover project IDs.
- `!request CFP-001 Describe a feature` to submit a feature. There is a fixed five-minute cooldown
  across projects, starting after a successful new request. Duplicates/invalid submissions do not consume it.
- `!bug CFP-001 Describe the bug` to report a bug. It has separate intake protections and does not
  consume/reset the feature cooldown.
- `!vote CF-101` for one vote per account and request.
- `!me` for the actor's rank, XP, currency, reputation and contributions.
- `!ranks [page]` for the named ladder and XP thresholds; `!help` for command syntax.

Local command tests use separate simulator identities and also begin with `!register`.

## Earning rules

Starting rates are 1 currency unit and 1 XP per credited minute, 10 reputation and 10 XP per screened
feature, and 50 reputation and 50 XP per accepted feature. Bug reports do not earn feature rewards.
Registration grants no opening balance. Each feature milestone is rewarded once; retries, re-screening
and external note edits cannot repeat it.

Time is labelled **tracked chat-presence time**. CoForge polls the live session and complete chat
presence snapshots, and credits registered, unrestricted players present in consecutive samples of the
same live stream. It does not backfill offline, restart or unavailable-data gaps. Partial minutes are
retained; rewards are issued for complete credited minutes. Twitch's list can lag joins/leaves and is
not proof of video viewing. The streamer account needs `moderator:read:chatters` as well as the existing
moderation permissions. [Official chatters API](https://dev.twitch.tv/docs/api/reference/#get-chatters).

## Manage the population

**Players** lists all registered accounts with search, status filtering and pagination. Select one for
rank, XP, currency, reputation, tracked time, requests, votes, accepted contributions and recent rewards.

**Block participation** is local to CoForge: it prevents requests, bugs, votes and rewards without
deleting the account or its balances. **Mute** is a Twitch timeout; **Ban** is a Twitch channel ban.
Review the target and parameters, then confirm. **Unmute / unban** removes the Twitch restriction;
it does not remove a separate CoForge block.

Unknown moderation outcomes are held across reloads. Refresh the player from Twitch before another
action. External moderation changes are reflected by an explicit player refresh and by presence checks
for registered players currently in chat; the last-check timestamp remains visible.

## Recurring bot messages

Open **Stream chat → Bot messages**. Add text (up to 500 characters) and an interval (1–240 minutes).
New/edited messages start paused. Activate messages individually; automatic bot messages and a connected
chatbot with write permission are required. Recurring messages are bound to their configured channel.

The first post follows a full live interval. Offline time/reconnects do not produce catch-up bursts;
pausing cancels unsent copies. A send already in flight may still finish. The list shows confirmed-send
time and delivery-pause reasons. Failed/unconfirmed delivery pauses the message for inspection. Check
the channel before explicitly reactivating it. Queue-full occurrences are skipped and counted, with fair
scheduling of due messages. Delivery rate limits and unknown outcomes are handled by the shared outbox.

## Operations

**Operations** groups participation, bot/moderation and AI workflow statistics, with a filterable
operational log. Retained/omitted history is labelled; cumulative counters and reward claims are kept.
Safe diagnostic export contains technical codes and aggregates, not raw chat, notes, player identities,
paths or credentials. See [Foundations](FOUNDATIONS.md) for architecture, contracts and event seams.
