# Keiki track: the league agent players text

Written from `main` at commit 2583041 on November 15, 2026. Each claim names the file and function to open.

## The case

Lineup's proof moment happens away from the app: at the gym, at a desk, at a park. A quick-time drop arrives as a text, and the answer is a photo sent back. So the league agent is a Keiki agent on iMessage, run as an external harness: Keiki pushes every message to `POST /keiki/turn`, and one Convex action, `answerTurn` in `convex/keiki.ts`, answers it. The agent is trusted with league state. It works out who is texting from the phone number, stores the photo, runs the same AI referee as the in-app camera, writes the score, and replies with the verdict, the points and the new rank. The in-app chat (`app/chat/index.tsx`, `chat` in `convex/keiki.ts`) reaches the same agent through Keiki's OpenAI-compatible gateway, so a command means the same thing in both places.

## What a player can do entirely by text

Only the first row needs the app, once.

| The player sends | What happens | Handled by |
| --- | --- | --- |
| The text the app's Play by text switch writes: "Lineup, I'm in (join code)" and a link code | Ties the sending number to the account and opts it in. Reply: "You're connected. Drops and verdicts land here. Send a photo to prove a task, or text STANDINGS." | `linkPhone` in `convex/keiki.ts`; `joinLink` in `convex/lib/keikiText.ts` |
| A photo while a quick-time drop is live | Counts for the drop. The referee must see the drop's gesture in it. The reply gives the verdict, the reason, the points and the rank. | `answerPhoto`, `judge` in `convex/keiki.ts` |
| A photo at any other time | Goes to the open photo task the caption names ("laundry done" matches "Do laundry"), or to the only one open. With several open the agent asks "Which task is this for?" and a reply of `2` picks it. | `chooseProofTarget`, `taskNamedIn` in `convex/lib/keikiText.ts` |
| `STANDINGS` | The top eight of the league the player joined last. | `answerText` in `convex/keiki.ts`; `tableForLeague` in `convex/standings.ts` |
| `OPEN` or `OPEN 30` | Opens today's sealed mystery task, with an optional wager of the player's own points, capped at 50. | `acceptMysteryFor` in `convex/drops.ts`; `clampWager` in `convex/lib/scoring.ts` |
| `PASS` | Closes the envelope: "Passed. Nothing lost." | `passMysteryFor` in `convex/drops.ts` |
| `IN` | RSVPs to the next group session. The check-in itself needs GPS, so it happens in the app. | `rsvpFor` in `convex/drops.ts` |
| "run tomorrow 7am at Dolores Park" | One model call reads a title, a place and a time out of it. The session is created and the league is told. | `answerFreeText` in `convex/keiki.ts`; `createGroupSessionFor` in `convex/drops.ts` |
| Any other question | One or two lines answered from the standings and the player's open tasks. If the model cannot be reached, the command menu. | `answerFreeText`, `leagueFacts` in `convex/keiki.ts` |

Two things do not work by text today: a photo for a task tied to a place, and any video. See the limits below.

## What the league agent sends on its own

Other modules never call Keiki themselves. Each schedules `send` in `convex/keiki.ts` with a player or a league and a text, and `send` texts each opted-in phone. Braces mark values the code fills in.

| Text | Trigger | Wording in the code |
| --- | --- | --- |
| Quick-time drop | `openDrop` in `convex/drops.ts`, scheduled by `triggerQuickTime` | `quickTimeText`: "Quick-time: {title} in the next 2 hours, {gesture} in the photo. +{points}. Reply with a photo." |
| Daily mystery task | Cron "daily mystery task" in `convex/crons.ts`, 16:00 UTC (8 AM Pacific in winter), then `sealMystery` in `convex/drops.ts` | `mysteryText`: "Mystery task: {slot}, 30 to 60 points. Reply OPEN or PASS." |
| Lead change | `afterProof` in `convex/leadChange.ts`, scheduled by `record` in `convex/proofs.ts` on every pass | `leadChangeText`: "{name} took the lead in {league}: {points} points, {gap} ahead of {name}." |
| Challenge opened and closed | `open` and `settle` in `convex/challenges.ts` | `challengeOpenedText`: "{challenger} challenged {owner}'s "{task}" proof. Vote in the app." `challengeResultText`: "The league upheld {owner}'s "{task}" proof. The points are back and {challenger} loses 10." |
| Group session announced | `startGroupSession` in `convex/drops.ts`, from the app or a texted proposal | `groupAnnouncementText`: "{creator} started a group session: {title} at {place}, {day and time}. Reply IN to join." |
| Group reminder and wrap-up | `openDrop`, 30 minutes before the start, to those who RSVP'd; `close`, when check-in ends | `groupReminderText`: "{title} at {place} starts in {duration}. Check in there with a group photo." `groupWrapUpText`: "{title} is done: {n} people checked in, +{points} each." |
| Evening and last-day nudges | Cron "check-in nudges", hourly, then `nudge` in `convex/checkins.ts`. Evening from 6 PM Pacific if nothing was proved that day; last day from 10 AM if a slot is still open. | `eveningText`: "{task} isn't on the board yet. {rival}'s up {gap}. Reply with a photo." `lastDayText`: "Last day. {slots} are still open. {stake} is on the line." |
| A rival passed you | `afterProof` in `convex/checkins.ts`, scheduled by `record` in `convex/proofs.ts` | `passedText`: "{rival} just passed you in {league}, up {gap}. {task} flips it. Reply with a photo." |
| Arrival | `recordArrival` in `convex/checkins.ts`, called by the app within 30 m of a task's place | `arrivalText`: "You're at {place}. Reply with a photo to check in." |

The copy lives in `convex/lib/dropRules.ts`, `convex/lib/checkinRules.ts`, `convex/leadChange.ts` and `convex/challenges.ts`. The check-in texts in the last three rows also obey `mayText` in `convex/lib/checkinRules.ts`: nothing between 10 PM and 8 AM Pacific, and at most three a day per player. Drop, lead and challenge texts have only the opt-in filter.

## How a texted photo becomes points

1. Keiki posts the turn to `/keiki/turn` (`convex/http.ts`). `keikiTurn` in `convex/keiki.ts` reads the raw body, and `verifyKeikiSignature` in `convex/lib/keikiProtocol.ts` checks the `Keiki-Signature` header (HMAC-SHA256 over "{timestamp}.{raw body}") before any JSON is parsed. It answers 202 and schedules `answerTurn`.
2. `playerFor` maps the sender's number to a user through the `by_phone` index on `users` (`convex/schema.ts`).
3. `proofTargets` lists what the photo could prove this week. `chooseProofTarget` picks the live quick-time drop first, then the task the caption names, then the only open photo task. Otherwise the agent asks.
4. `ingest` in `convex/keikiMedia.ts` downloads the attachment with a bearer signed for that turn (`signTurnCredential`), names the type from its bytes, turns HEIC into JPEG, and stores the file in Convex file storage.
5. `verifyForUser` in `convex/proofs.ts` calls `runVerification`, the same function behind the app's `verify`. The model describes the image (`judgeProof` in `convex/ai.ts`), pure code decides (`decideVerdict` in `convex/lib/verdict.ts`), and `record` writes the proof row with `via: "keiki"` and marks the task verified in one transaction.
6. `judge` reads the standings and posts the reply to the turn (`postToTurn`): "Verified, +{points}. {the referee's reason} You're 2nd, 15 behind Maya." The Feed tab reads `list` in `convex/feed.ts`, a query over passing proofs, so the new item appears there.

## Trust and consent

- **Signature.** `keikiTurn` answers 401 when the header is missing, malformed, more than five minutes old or does not match, and 503 when the signing secret is not set. Events that are not turns are acknowledged and ignored (`parseKeikiEvent`).
- **Opt-in.** `phonesOf` in `convex/keiki.ts` returns only accounts with `users.keikiOptIn` set, so `send` texts nobody else. A player opts in with the Play by text switch (`components/keiki/PlayByTextRow.tsx`, `setOptIn`), which opens Messages with the join text typed, or by texting the number from a phone the app already knows (`recordOptIn`).
- **Stopping.** Turn the switch off in the app. There is no STOP command in `parseCommand`. Once off, a plain text does not turn it back on; the switch or the join text does. A player who texts the agent while switched off still gets an answer to that message.
- **Linking.** The link code ends in eight hex digits of an HMAC under the agent's signing secret (`signLinkCode`), so knowing someone's user id is not enough to attach a phone to their account.
- **Unknown numbers** get one reply, and nothing is downloaded or scored: "This number isn't linked to a Lineup account yet. In the app, tap Play by text and send the message it writes."
- **What is stored.** The photo in Convex file storage, the proof row with the verdict, the phone number and opt-in flag on `users`, and a log row for each check-in text (`checkinNudges`). Keiki's turn token and signed attachment URLs are never stored. The message text and recent history ride in the scheduled action's arguments. The photo goes to the OpenAI referee, as an in-app proof does, and a free-text message goes to OpenAI with the standings and the player's open task titles (`leagueFacts`). `send` logs counts, never phone numbers.

## What the sandbox could not do

- **No dedicated line.** The agent sits on Keiki's shared number behind a join code (`KEIKI_LINE_NUMBER`, `KEIKI_JOIN_CODE` in `convex/convex.config.ts`). A dedicated iMessage line costs money and was not bought. On the shared number the agent may only text someone who texted it first, so the Play by text switch opens Messages with the join text typed, and `send` skips anyone who has not sent it.
- **No league group chat.** `leagues.keikiConversationId` is in the schema and nothing reads or writes it. A league text goes to each opted-in member one-to-one.
- **Texted photos for location tasks are refused.** The owner's rule is that a texted photo counts when the app recorded an arrival at the place in the last 60 minutes. The agent's half is built: `recentArrival` in `convex/checkins.ts` keeps the arrival for 60 minutes and `answerPhoto` passes its coordinates on. But `rejectionBeforeJudging` in `convex/proofs.ts` still turns away every texted proof for a location task. So the arrival text invites a photo that is then refused, and location tasks are proved in the app.
- **Texted videos are stored but not judged.** The referee needs still frames, which only the app samples. The reply is "Videos can't be checked from a text yet. Send a photo instead."
- **Arrivals are foreground only.** `components/checkin/CheckInPrompt.tsx` reports an arrival while the app is open on Roster. Nothing tracks location in the background.
- **Quick-time drops start by hand.** Only `triggerQuickTime`, the Demo controls button, starts one. No schedule does.
- **Settlement results are not texted.** The only callers of `send` are `convex/drops.ts`, `convex/challenges.ts`, `convex/checkins.ts` and `convex/leadChange.ts`.
- **Apple Watch: notifications only.** There is no watch app and no watch code in this repository. The agent's texts are ordinary iMessages, which a paired watch shows as notifications. That is iOS behaviour and was not tested here. The watch slide drawn by `scripts/slides/render.mjs` is a concept.
- **Not confirmed on a physical phone.** The Keiki thread reports (pull requests #60 and #116) that signed turns pushed through Keiki's gateway were verified, judged and answered by the deployed backend. A real iMessage from a real phone is the owner's check (test 7 in `docs/demo/REAL_PHONE.md`), and row 4 of `docs/demo/ACCEPTANCE.md` reads "not run". `convex/keiki.test.ts` tests linking and who a number resolves to; `answerTurn`, `send` and `chat` are covered only through their pure helpers.

## Check it yourself

```bash
npm ci
npx vitest run convex/lib/keikiProtocol.test.ts convex/lib/keikiText.test.ts convex/keiki.test.ts \
  convex/lib/mediaType.test.ts convex/proofs.test.ts convex/drops.test.ts convex/lib/dropRules.test.ts \
  convex/leadChange.test.ts convex/checkins.test.ts convex/lib/checkinRules.test.ts convex/challenges.test.ts
```

These 11 files passed when this was written. They cover the signature check and its replay window, command parsing, photo-to-task matching, every reply, phone linking, a texted proof through `verifyForUser`, and the outbound texts for drops, challenges, lead changes and check-ins. No test calls Keiki: when Keiki is not configured, `send` logs the text it would have sent and the tests read that.

To text it:

1. In the app, open the League tab and turn on **Play by text**. Messages opens with the join text typed. Send it. The row shows the number to text. The tests use +17796251378 and join code K-ZL2PWU (`convex/lib/keikiText.test.ts`); the deployment supplies the live values.
2. Text `STANDINGS`.
3. Long-press the week label under the tabs to open Demo controls (`app/(tabs)/_layout.tsx`) and tap **Trigger Quick-Time Drop**. Reply to the drop text with a photo that shows the gesture, then open the Feed tab.
4. Text "run tomorrow 7am at Dolores Park", then `IN` from a second opted-in phone.
