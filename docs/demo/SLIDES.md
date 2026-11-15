# Slide words for the pitch screenshots

One headline and one supporting line for each of the seven screenshots, in pitch order. Every line was checked against the code on `main` on November 15, 2026, and the file that backs it is named beside it.

Recommended order: Voice Draft, Roster, the verdict, Feed, League, Wrapped, the watch. It follows the product loop (draft, prove, compete, get paid) and keeps the one concept image for last.

## The seven slides

Names and numbers under "In the shot" are what Reset Seed writes (`reset` in `convex/seed.ts`) when it runs on a Sunday, before any live proof is added. A live proof changes them, so check each number against the screenshot. The framed slides are rendered from `scripts/slides/slides.json`; these lines reach the images only when they are copied there.

### 1. Voice Draft

- **Headline:** Draft your week by talking
- **Supporting line:** Up to 60 seconds of speech becomes a lineup, each task priced 10 to 50 points.
- **In the shot:** The review step: the transcript in grey, the LINEUP and PTS list with one row per task (BOD, MND, RCH, CHR, PPL and FLX pills), and the Lock Lineup button (`VoiceDraftScreen.tsx` and `DraftLineup.tsx` in `components/capture/draft/`). On a cloud phone the words are the typed sample (`SAMPLE_TRANSCRIPT` in `lib/devFlags.ts`: leg day, an algorithms problem set, reading, laundry, a call to mom, the YC office, a 5k run), because a simulator has no microphone. The model writes the titles and points on each run, so read them off the screenshot.
- **Say:** "I talk through my week once. It comes back as a lineup with points on every task, and I lock it."
- **Alternates:** "Say your week, get a lineup" or "Your plans, priced in points"
- **Code:** the 60-second cap is `MAX_RECORDING_MS` in `components/capture/draft/recordingMeter.ts`. The recording is transcribed and drafted by `transcribe` and `draftLineup` in `convex/ai.ts`, called from `draft` in `convex/lineup.ts`. Points are held to 10 to 50 by `clampTaskPoints` in `convex/lib/scoring.ts`. Nothing is locked until the player taps Lock Lineup (`lock` in `convex/lineup.ts`).

### 2. Roster

- **Headline:** Your whole week on one screen
- **Supporting line:** Five starter slots plus flex, with Submit Proof on the Up Next row.
- **In the shot:** Switched to Sam Patel in Demo controls: league "YC Hackathon", Week 5. Starters: Bike to work 30.0, Ship the onboarding PR 40.0, Journal for ten minutes 15.0, Clean my room 25.0, and Call mom tinted and tagged UP NEXT with a Submit Proof button. Under "Flex and bonus": 20 push-ups 50.0. TOTAL 160.0.
- **Say:** "This is the screen I open every day. Five slots, the next task highlighted, and its camera is one tap away."
- **Alternates:** "Your week is a roster" (the line already in `scripts/slides/slides.json`) or "One tap from task to camera"
- **Code:** the screen is `app/(tabs)/index.tsx`; the starter and flex split is `splitRoster` in `lib/roster.ts`; Up Next is chosen by `roster` in `convex/lineup.ts`. The total on this screen is task points only. The League table adds slot and streak bonuses (`scoreWeek` in `convex/lib/scoring.ts`), which is why Sam shows 285.0 there and 160.0 here.

### 3. The verdict

- **Headline:** An AI referee judges your photo
- **Supporting line:** The referee stamps VERIFIED or NOT VERIFIED and writes its reason under the photo.
- **In the shot:** The proof photo with the green VERIFIED stamp across it, the reason in large type below, the points line (for example +35.0) and a Done button. One way to get it on a cloud phone: as Leo Martinez, submit the bundled Gym sample photo for his open "Gym session", worth 35 points. The model writes the reason at that moment, so read it off the screenshot. The screen shows no confidence number; a pass with confidence from 0.6 to 0.75 gets a CLOSE CALL tag instead.
- **Say:** "I take the photo. The referee says pass or fail and tells me why, in words the whole league will read."
- **Alternates:** "Every proof gets a ruling" or "Pass or fail, with a reason"
- **Code:** `VerdictScreen.tsx`, `StampBadge.tsx` and `VerdictPanel.tsx` in `components/capture/verdict/`. The model reports what it sees (`judgeProof` in `convex/ai.ts`) and the pass line, the close-call band and the distance rule are decided in code (`convex/lib/verdict.ts`). A failed proof shows a dash for points and a Retry button, and the task stays open.

### 4. Feed

- **Headline:** Your league sees every verified proof
- **Supporting line:** Another member can challenge a proof within 24 hours, and the league votes.
- **In the shot:** Viewed as any player but Sam: the top post is Sam Patel's "Clean my room" (CHR, 25.0) with its photo, the caption "You can see the floor again.", the line "REFEREE Bed made, floor clear and a vacuum in the corner, the room is clean.", four reaction buttons and a Challenge link. Further down, Jordan Lee's "Pickup basketball" carries a CLOSE CALL tag. Failed proofs, such as Leo Martinez's couch photo, are not listed.
- **Say:** "Every verified proof posts to the league. Friends react, and a member who doubts a photo can put it to a vote."
- **Alternates:** "Proofs post to the whole league" or "Doubt a proof, challenge it"
- **Code:** `FeedScreen.tsx`, `ProofPost.tsx` and `ReactionBar.tsx` in `components/social/feed/`. Only passing proofs are listed (`list` in `convex/feed.ts`). The 24-hour window is `CHALLENGE_WINDOW_MS` in `convex/challenges.ts` and `canChallenge` in `components/social/feed/feedLogic.ts`. A challenge that fails costs the challenger 10 points (`CHALLENGER_STAKE`).

### 5. League

- **Headline:** Everyone plays for the same pot
- **Supporting line:** Clear all five slots to keep your stake; finishers split forfeited stakes, less 10%.
- **In the shot:** POT $120, "$20 buy-in", a "Settles in" countdown and PAID 6 with six names. Then the leaderboards strip: the viewer's place, the gap to the next player and a "Projected:" figure in dollars. Then the table: Maya Chen 5/5 500.0, Sam Patel 4/5 285.0, Priya Shah 3/5 195.0, Jordan Lee 2/5 120.0, Ava Kim 1/5 60.0, Leo Martinez 0/5 0.0. The projection is recomputed each hour, so read it off the screenshot.
- **Say:** "Six of us put in twenty dollars. Clear your five slots and you keep it. Miss, and the finishers split it."
- **Alternates:** "Finish your week, keep your stake" or "The table updates with every proof"
- **Code:** `app/(tabs)/league.tsx`, `PotSummary.tsx` and `StandingsTable.tsx` in `components/leagueTab/`, `LeaderboardsStrip.tsx` in `components/leaderboards/`. The payout rule is `computeSettlement` in `convex/lib/settlement.ts`; the projection is `projectPayout` in `convex/lib/projection.ts`; the seeded totals are asserted in `convex/seed.test.ts`.
- **Limits:** No real money moves. Whop runs in sandbox only (`convex/whop.ts`), and the seeded stakes are ledger rows that never touched Whop (`convex/seed.ts`). Head-to-head matchups are on the MATCHUP tab (`app/(tabs)/matchup.tsx`), not on this screen. Payout rows appear here only after the week is settled (`components/leagueTab/PayoutRows.tsx`).

### 6. Wrapped

- **Headline:** Every week ends with a recap
- **Supporting line:** Five cards cover the champion, best proof, biggest comeback, fastest quick-time and your week.
- **In the shot:** The first card: LEAGUE CHAMPION, "500 pts", "League champion" and "Maya Chen · 215 ahead of Sam Patel" over Maya's highest-rated proof photo, with five progress segments along the top.
- **Say:** "The week closes with five cards: who won, the best photo, the biggest comeback, the fastest drop, and your week."
- **Alternates:** "Your week in five cards" or "See who won the week"
- **Code:** the cards are built by `buildCards` in `convex/wrapped.ts` and drawn by `WrappedScreen.tsx` and `WrappedCard.tsx` in `components/social/wrapped/`.
- **Limits:** Wrapped opens at any time from Week Stats on Roster or Week Wrapped on Feed. It recaps the latest settled week, or the week in play when none is settled (`pickWeek` in `convex/wrapped.ts`). The seed leaves every week unsettled, so this shot is the week in play unless End Week Now was run first.

### 7. The watch (concept image)

- **Headline:** Drops reach your wrist by text
- **Supporting line:** This is a concept image; Lineup has no watch app and sends iMessage texts through Keiki.
- **In the shot:** The drawn watch face that `scripts/slides/render.mjs` writes to its output folder as `watch-concept.png`, showing a Messages notification from Lineup. It is rendered from HTML, not captured from a watch, and the slide must keep its "Concept" label. Its body text is a paraphrase of what the backend sends.
- **Say:** "There is no watch app. A drop is a text, so a watch can show it. This picture is a mock-up."
- **Alternates:** "A drop is just a text" or "No watch app, only texts"
- **Code:** a quick-time drop is texted as "Quick-time: 20 push-ups in the next 2 hours, three fingers up in the photo. +40. Reply with a photo." (`quickTimeText` in `convex/lib/dropRules.ts`; the task and gesture are picked at random). The reply to a texted proof is "Verified, +40." followed by the referee's reason and a rank line such as "You're 2nd, 15 behind Maya." (`reply.verdict` and `rankLine` in `convex/lib/keikiText.ts`).
- **Limits:** Nothing in the repository is specific to a watch. A text shows on a wrist only because iOS mirrors phone notifications, and no test in the repository covers that. Texts go only to players who turned on Play by text and have texted the shared number first (`send` in `convex/keiki.ts`, `components/keiki/PlayByTextRow.tsx`). A verdict arrives by text only as the reply to a photo sent by text; a proof submitted in the app shows its verdict in the app.

## Opening and closing lines

Title slide, two options:

1. "Lineup is a fantasy league for your own life." (the first line of `README.md`)
2. "Draft your week, prove it, and play your friends."

Closing slide, two options:

1. "Clear your five slots and you keep your stake." (`computeSettlement` in `convex/lib/settlement.ts`)
2. "Say your week, prove it, and see who finished."

Say "stake", not "real money": payments run in the Whop sandbox today (`convex/whop.ts`).

## Numbers you can put on a slide

Each number is a constant or a tested value on `main`.

| Number | What it is | Where |
| --- | --- | --- |
| 6 | Slot types: five starters (body, mind, recharge, chores, people) plus flex | `SLOT_ORDER` in `lib/slots.ts`, `CORE_SLOTS` in `convex/lib/scoring.ts` |
| 10 to 50 | Points one task is worth | `clampTaskPoints` in `convex/lib/scoring.ts` |
| +25, +100 | Bonus for each cleared slot, and for clearing all five | `slotBonus` in `convex/lib/scoring.ts` |
| 5 to 25 a day | Streak bonus: day n of an unbroken run pays 5n, capped at 25 | `streakBonus` in `convex/lib/scoring.ts` |
| +50 | To the head-to-head winner once the week is settled | `matchupBonus` in `convex/lib/scoring.ts`, applied in `convex/standings.ts` |
| 60 seconds | Longest voice draft recording | `MAX_RECORDING_MS` in `components/capture/draft/recordingMeter.ts` |
| 10 seconds | Longest video proof; three stills from it are judged | `MAX_VIDEO_SECONDS` in `components/capture/camera/recording.ts`, `MAX_CLIP_SECONDS` in `convex/lib/clip.ts`, `MAX_VIDEO_FRAMES` in `convex/proofs.ts` |
| 150 m | How close the phone must be for a location check-in | `CHECK_IN_RADIUS_M` in `convex/lib/geo.ts` |
| 0.6 | Confidence below which a proof fails; 0.6 to 0.75 passes as a close call | `PASS_CONFIDENCE` and `CLOSE_CALL_CONFIDENCE` in `convex/lib/verdict.ts` |
| 24 hours, 12 hours, 10 points | Time to challenge a proof, time the vote stays open, and what the challenger wins or loses | `CHALLENGE_WINDOW_MS`, `VOTE_WINDOW_MS`, `CHALLENGER_STAKE` and `challengerDelta` in `convex/challenges.ts` |
| 2 hours, +10 | Quick-time drop window, and the bonus for finishing first | `QUICK_TIME_WINDOW_MS` in `convex/lib/dropRules.ts`, `FIRST_FINISHER_BONUS` in `convex/lib/scoring.ts` |
| 10% | Platform fee, taken from forfeited stakes only; no fee when nobody finishes | `PLATFORM_FEE_RATE` and `computeSettlement` in `convex/lib/settlement.ts` |
| 6 players, $20, $120 | The seeded league, its buy-in and its pot | `LEAGUE` and `PLAYERS` in `convex/seed.ts` |
| Week 5 of 8 | Where the seeded season stands | `CURRENT_WEEK` and `LEAGUE.seasonWeeks` in `convex/seed.ts` |
| 500, 285, 195, 120, 60, 0 | Seeded week totals, Maya Chen down to Leo Martinez | `convex/seed.test.ts` |
| 5 | Wrapped cards | `buildCards` in `convex/wrapped.ts` |

Leave these off the slides, because the code does not support them:

- "Thirty seconds" for the draft. The recorder allows 60 seconds; "about 30 seconds" appears only in the model's instructions (`convex/ai.ts`).
- "Real money". Whop is sandbox only.
- Any time for how fast a verdict arrives. The repository holds no measurement.
- A confidence figure on the verdict screen. The screen does not show one.
- User counts or usage figures. The only league data is the seed.
