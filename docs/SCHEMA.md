# Schema

Every table in `convex/schema.ts`, what it holds, and why each index exists. The schema file is the source of truth; this page explains it.

## Keys that shape everything

- **A week is `weekStart`.** It is the epoch milliseconds of Monday 00:00 in America/Los_Angeles (`convex/lib/week.ts`). A player has one lineup per week, and it scores in every league they belong to. So `lineups`, `tasks` and `proofs` are keyed by `(userId, weekStart)`, never by league.
- **League-specific rows hang off a league or one of its weeks.** `weeks.startsAt` equals `weekStart` for the same calendar week. A task with a `dropId` scores only in that drop's league.
- **Standings are not stored.** `convex/standings.ts` recomputes them from `tasks`, `proofs`, `challenges` and `ledger` inside a query, so every phone reorders as soon as a proof is written. Only two tables hold derived data, both rebuildable at any time: `scores` (for leaderboards) and `checkinMarks`.
- **New fields are optional.** Rows written before a field existed stay valid without a migration, and settings are read through `resolveSettings` in `convex/lib/schedule.ts`, never straight off the row.
- **Every read goes through an index.** There are no table scans on a growing table; each index below names the read it serves.

The Convex Auth tables (`authSessions`, `authAccounts` and the rest) come from `authTables` and are managed by `@convex-dev/auth`.

## Players and leagues

**`users`**: one row per device account. Convex Auth creates it on the first anonymous sign-in, which is why every Lineup field is optional. It holds the name, phone (E.164), avatar, Whop user id, the text opt-in (`keikiOptIn`), the push switch, and `demoActAs` for the demo's Switch Player.
- `email`: required by Convex Auth under this exact name.
- `by_phone`: matches an incoming text to a player (`convex/keiki.ts`) and matches contacts (`convex/users.ts`).
- `by_demoActAs`: finds the devices acting as a seeded player, so they receive that player's texts and pushes.

**`leagues`**: name, invite code, stake, visibility, size cap, the league's Whop company, and the creator's settings (`payout`, `seasonWeeks`, `format`). `leaderId` remembers who led when the last lead-change text went out. `mode: "versus"` marks a two-player challenge (`convex/versus.ts`), so every other module works unchanged.
- `by_inviteCode`: joining by code.
- `by_visibility_stake`: Quick Match looks for an open public league at a stake.

**`memberships`**: one row per player per league, with `paid` and the Whop payment and member ids.
- `by_league`: the league's members.
- `by_user`: the leagues a player is in.
- `by_league_user`: the single membership check used by nearly every league-scoped function.

**`weeks`**: one row per league week, `open` or `settled`. The latest row is the league's current week.
- `by_league`: the league's weeks, newest first.

**`matchups`**: the head-to-head pairs of a week. `scoreA` and `scoreB` are frozen once the week ends, so the season view never rescores old weeks.
- `by_week`: the week's pairs.

## The week

**`lineups`**: the transcript and lock time of a player's drafted week.
- `by_user_week`: the lineup of one player for one week.

**`tasks`**: one row per task: slot, title, points, proof type (`photo`, `photo_location`, `canvas`), optional pinned place, Canvas ids, and status (`open`, `verified`, `held` while challenged, `failed`). `source` says where the task came from. `points` is final: a drop's bonus is written into it when earned, so no read adds it again.
- `by_user_week`: a player's roster, the main read behind Roster and standings.
- `by_drop`: the tasks of one drop.

**`proofs`**: one row per submission, with the media, coordinates, the referee's verdict as stored (`pass`, `confidence`, `reason`, `highlight`, `caption`) and `via` (`app`, `keiki` or `canvas`).
- `by_user_week`: a player's proofs for the week (streak days, feed, wrapped).
- `by_task`: the proofs of one task.

## Social

**`reactions`**: one emoji by one player on one proof.
- `by_proof`.

**`challenges`**: a league member disputes a proof. Status `open`, `upheld` or `overturned`, with `closesAt`.
- `by_proof`: one challenge per proof.
- `by_status`: open challenges.
- `by_league` on `[leagueId, closesAt]`: standings read the challenges decided in one week without scanning the league's history.

**`votes`**: one vote per member per challenge.
- `by_challenge`.

## Drops

**`drops`**: a bonus task offered to a league during the week: a `quicktime` drop or a `group` session (place, headcount and group photo). `opensAt`, `closesAt` and `status` are moved by scheduled functions in `convex/drops.ts`. Rows of kind `mystery` remain from a feature that was removed.
- `by_league_status`: the league's live or scheduled drops.

**`rsvps`**: who joined a group session and whether they checked in.
- `by_drop`.

## Money

**`ledger`**: every money movement in a league: a `buy_in` row per verified Whop payment, then `refund`, `winnings` and `fee` rows at settlement that sum to the buy-ins. `whopId` is set once Whop accepts the transfer.
- `by_league`: the pot and the payouts.
- `by_idempotencyKey`: a webhook delivered twice, or a settlement run twice, finds its existing row and writes nothing new.

## Leaderboards and check-ins

**`scores`**: a stored copy of one player's week in one league (`weekStart` 0 is the all-time row), with today's stats and yesterday's for "movement since yesterday". Only `leaderboards.refresh` and `leaderboards.rebuild` write it, and both can be rerun at any time.
- `by_league_week_user`: one league's board for a week.
- `by_user_week`: one player's rows across leagues.
- `by_week_points`: the cross-league board, ranked straight off the index.

**`checkinNudges`**: one row per check-in text sent.
- `by_user_day`: the three-a-day cap and "already sent today" in one read.

**`checkinMarks`**: each member's points the last time `convex/checkins.ts` looked, so the next proof can tell who was just passed.
- `by_league_user`.

**`arrivals`**: where a player was when the app saw them arrive at a task's pinned place. A text carries no GPS, so this row is the location evidence for a photo texted from that place.
- `by_user_task`.

## Integrations

**`canvasConnections`**: a player's Canvas school and access token. No row or field of it is ever returned to a client.
- `by_user`.

**`keikiTurns`**: Keiki turn ids already taken on, so a turn delivered twice is answered once. Rows are deleted after an hour.
- `by_turnId`.

**`pushTokens`**: Expo push tokens per device account. It is a separate table, so a token that moves to a new account after a reinstall can be found and detached.
- `by_user`, `by_token`.

**`inviteLinks`**: one short invite token per inviter and league, behind the `GET /i/<token>` page (`convex/referrals.ts`).
- `by_token`: the page lookup.
- `by_inviter_league`: sharing again reuses the same link.

**`referrals`**: one row per invited player, ever.
- `by_invitee`: stops a second link from counting the same friend twice.
- `by_inviter`: an inviter's referrals.
