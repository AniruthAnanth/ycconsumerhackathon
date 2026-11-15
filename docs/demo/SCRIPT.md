# The two-minute demo script

Two phones, six steps, about 120 seconds. On-screen labels are in **bold**, spelled as the app shows them. The line labels in each step (**Time:**, **Tap:** and so on) are this script's own.

Checked against `main` at commit `b756bcd` on November 15, 2026. If a label here is not on the screen, trust the screen.

- Phone A is the presenter's phone, signed in as the presenter's own account.
- Phone B is the league's view. It acts as the seeded player Sam Patel and stays on **LEAGUE**.
- Both phones have been through first launch once (**NAME**, **PHONE**, **Join**), or they cannot reach the tabs. Phone A used its own number.

Demo controls open with a long press (about one second) on the week label, **Week 5**, under the tabs.
Source: `app/(tabs)/_layout.tsx`, `components/ui/WeekSelector.tsx`, `components/capture/demo/DemoControls.tsx`.

## Before you walk up

Run this top to bottom. It takes under a minute once the permissions are granted.

1. Reset the league. Either phone: **Demo controls**, tap **Reset Seed**, wait for **DONE**.
   It restores "YC Hackathon": six seeded players, all paid, week 5 (`restoreSeed` in `convex/seed.ts`).
2. Rejoin on Phone A. Reset removes every member who is not one of the six (`clearLeague` in `convex/seed.ts`).
   Phone A lands on **Join a League**. Under **INVITE CODE**, type `YCHACK` in **CODE** and tap **Join**. The league is private, so the code is the only way in.
   If Phone A is in another league it stays on the tabs: tap the league name in the header, then **Join or create a league**.
3. Get back to the roster. Joining opens **Add Friends**: tap **Skip**. If **Voice Draft** opens next, tap the back chevron.
4. Check the header. It reads **YC Hackathon** on both phones. If it shows another league, tap it and pick **YC Hackathon**.
5. Phone A plays as itself. **Demo controls**, under **SWITCH PLAYER**: **PLAYING** is beside **Me**. If not, tap **Me**.
6. Phone A's roster is empty. It shows five **Empty** rows, the **Draft your week** button and the banner **Pay your $20 buy-in**.
   If it already lists drafted tasks, read "Known rough edges" before going on.
7. Opt in to texts on Phone A. **LEAGUE** tab, **NOTIFICATIONS**, **Play by text**: turn the switch on. Messages opens with a text typed: send it.
   Wait for the reply "You're connected. Drops and verdicts land here..." (`reply.welcome` in `convex/lib/keikiText.ts`).
   Nobody is texted without this (`phonesOf` in `convex/keiki.ts`). Do it before the demo, not on stage.
8. Pin the check-in where you will stand. Phone A: **Demo controls**, under **CHECK-IN**, tap **Pin check-in here**. Allow location when iOS asks. Wait for **DONE**.
   It adds "Check in at the YC office" to Phone A's roster, pinned to the phone's own position (`pinCheckIn` in `convex/demo.ts`).
   After this the roster shows that one task under **FLEX AND BONUS**, and **Draft your week** gives way to the total. A line tagged **HERE** may appear at the top, and one arrival text or alert may follow (`recordArrival` in `convex/checkins.ts`).
9. Phone B becomes Sam. **Demo controls**, under **SWITCH PLAYER**, tap **Sam Patel**. **PLAYING** moves to that row.
10. Park Phone B on the league tab. It shows **POT** $120, **PAID 6**, **UNPAID 1** and the presenter's row tagged **Unpaid**.
11. Permissions on Phone A. Microphone is asked on the first recording and camera on the first proof. Location was granted in item 8.
    In iPhone Settings check Camera, Microphone, Location and Precise Location are on for the app (`docs/demo/REAL_PHONE.md`).
12. Development switches off on a real phone. **Demo controls**, under **DEVELOPMENT**: **Sample media**, **Sample voice note** and **Location override** are off.
    They return to the build's default every time the app restarts (`lib/devFlags.ts`).
13. Test card. 4242 4242 4242 4242, any future date, any CVC (`docs/demo/REAL_PHONE.md`, test 6). Whop runs in the sandbox only (`whopClient` in `convex/whop.ts`).
14. Quiet phones. Do Not Disturb on Phone B. On Phone A allow Messages, because the drop text must show.
15. Screen lock off. Both phones: iPhone Settings, Display & Brightness, Auto-Lock, Never.
16. Starting screens. Phone A on **ROSTER**. Phone B on **LEAGUE**.

## The script

### 1. Speak the week

- **Time:** 25 seconds.
- **Tap:** **ROSTER**, **Voice Draft**. Tap the round record button (it has no text), speak, tap it again to stop.
  **LISTENING** shows, then **DRAFTING**, then your words, then **LINEUP**. Tap **Lock Lineup**. Roster fills.
- **Speak:** "Leg day at the gym, finish my problem set, read thirty minutes, do my laundry, and call my mom."
  Leave the YC office out. The pinned task from the checklist covers step 5.
- **Phone B shows:** no change. A draft scores nothing until a proof is verified.
- **Say:** "I say my week out loud and it becomes a lineup, one task per slot."
- **If it is slow:** keep talking while **DRAFTING** shows. If the red line "Couldn't draft your week. Try again." appears, record again.
  If the microphone fails, a **YOUR WEEK** box and **Draft from text** appear on their own (`micUnavailable` in `components/capture/draft/draftState.ts`). Type one line and tap it.
  If **Lock Lineup** is refused, a red line says why and **Go to Roster** appears. Tap **Redo** to record again, or **Go to Roster** to move on: only flex rows can be removed (`canRemoveTask` in `components/capture/draft/lineupEdit.ts`).
  Every path calls the same model. If none returns, go to step 2: the drop and the pinned check-in still give you tasks to prove.

### 2. Pay the buy-in

- **Time:** 20 seconds.
- **Tap:** **ROSTER**, the banner **Pay your $20 buy-in**. It reads **Opening checkout...**, then Whop's sandbox checkout opens in the in-app browser.
  Enter the test card, pay, close the browser.
- **Phone B shows:** **POT** goes from $120 to $140, **PAID 6** becomes **PAID 7**, and **Unpaid** leaves the presenter's row. No refresh.
  It changes when Whop's webhook reaches the backend, not when the browser closes (`recordBuyIn` in `convex/whop.ts`, `pot` in `convex/standings.ts`).
- **Say:** "Real checkout, sandbox money. Watch the pot on the other phone."
- **If it is slow:** if the banner reads **Checkout didn't open. Tap to try again.**, tap it once. If the page or the webhook stalls, close the browser and move on.
  No demo control marks a member paid. Say: "Unpaid players still play, they just can't win the pot. Six buy-ins are already in." Glance at Phone B again after step 4.

### 3. Trigger a drop

- **Time:** 15 seconds.
- **Tap:** long-press **Week 5**, **Demo controls**, **Trigger Quick-Time Drop**, wait for **DONE**, back chevron.
  The text on Phone A reads: "Quick-time: 20 push-ups in the next 2 hours, three fingers up in the photo. +40. Reply with a photo."
  The control always starts this one drop (`SHOWCASE_QUICK_TIME` and `quickTimeText` in `convex/lib/dropRules.ts`).
- **Phone B shows:** nothing on **LEAGUE**. The drop is a banner on Phone B's **ROSTER**, with a countdown and **Submit**.
- **Say:** "Any time in the week the league gets a surprise task by text. Here it is."
- **If it is slow:** the same drop is already a banner at the top of Phone A's **ROSTER**, with a line tagged **LIVE** above it. Neither depends on the text.
  Show it and say: "The text is on its way. The drop is live in the app."

### 4. Reply with a photo

- **Time:** 25 seconds.
- **Tap:** in Messages on Phone A, reply to the drop text with a photo of push-ups. Show three fingers up in the photo.
  The reply reads "Verified, +[points]. [reason] You're [rank], [gap] behind [name]." (`reply.verdict` and `rankLine` in `convex/lib/keikiText.ts`).
- **Phone B shows:** on **LEAGUE** the presenter's row gains points, and moves up when it passes a seeded player. A new post appears on **FEED**.
  Convex pushes the change. Acceptance check 1 sets a two-second target and is marked "not run" (`docs/demo/ACCEPTANCE.md`).
- **Say:** "An AI referee checks the photo and tells me why. The table just changed on the other phone."
- **If it is slow:** prove it in the app. Phone A, **ROSTER**, drop banner, **Submit**, take the photo. **REFEREE REVIEWING** shows, then the **VERIFIED** stamp, the reason and **Done**.
  It is the same referee (`convex/proofs.ts`). On **NOT VERIFIED**, read the reason aloud and tap **Retry**: the task stays open.

### 5. Check in at the YC office

- **Time:** 20 seconds.
- **Tap:** **ROSTER**. If the top line is tagged **HERE** and reads "You're at YC office.", tap its **Check In**. Otherwise tap "Check in at the YC office" under **FLEX AND BONUS**, then **Submit Proof** on **Task**.
  Take the photo, read the reason on the verdict screen, tap **Done**.
- **How it decides:** the proof passes within 150 m of the pin (`CHECK_IN_RADIUS_M` in `convex/lib/geo.ts`). The **HERE** line shows within 30 m, only while the app is open (`ARRIVAL_METERS` in `convex/lib/checkinRules.ts`, `components/checkin/useForegroundCoords.ts`).
  A live drop takes that top line first (`pickCheckIn`). If the line shows any other tag, its **Check In** opens a different task: use the task row.
- **Phone B shows:** the presenter's points rise on **LEAGUE**, and the post on **FEED** carries the **REFEREE** line.
- **Say:** "This task is pinned to this spot. GPS proves I'm here, the photo proves I did it."
- **If it is slow:** if the verdict reads "You're [distance] from YC office. Check in within 150 m.", tap **Close**. Then **Demo controls**, **Pin check-in here** from where you stand, and submit again.
  If GPS will not settle, use the seeded one: Phone B, **FEED**, Priya Shah's "Morning run at Dolores Park". Its referee line ends "checked in at Dolores Park." Say: "Here's one from earlier this week."
  On a cloud phone only: **Demo controls**, **Location override** on, **At the place**, then retake. Say out loud that the location is fixed for the simulator.

### 6. End the week

- **Time:** 15 seconds.
- **Tap:** long-press **Week 5**, **End Week Now**, wait for **DONE**, back chevron. **LEAGUE**: the pot line reads **Settled** and a **PAYOUTS** section lists who was paid, as "Refund" or "Winnings".
  Then **ROSTER**, **Week Stats**. Tap the right third of the screen to step through five cards, ending on **Your week**. The cross closes it.
- **Phone B shows:** **PAYOUTS** appears on **LEAGUE** at the same moment.
- **Say:** "Clear your five slots and you keep your stake. Whoever cleared them splits what the rest forfeit."
- **If it is slow:** the payout rows are written before any Whop call (`closeWeek` runs first in `settleWeek`, `convex/whop.ts`). Open **LEAGUE** without waiting for **DONE**.
  **Week Stats** opens the recap for the current week whether or not it has settled (`pickWeek` in `convex/wrapped.ts`), so show it either way.

Time adds up to 120 seconds: 25, 20, 15, 25, 20, 15.

## If everything fails

This path reads seeded data only. It makes no call to Whop, Keiki or OpenAI.

1. Phone A: **Demo controls**, **Reset Seed**, then **Sam Patel** under **SWITCH PLAYER**.
2. **ROSTER**: Sam's week. Four starters verified, "Call mom" open, and under **FLEX AND BONUS** the open "Check in at the YC office" and the proven drop task "20 push-ups".
3. **FEED**: seeded proofs, each with a photo, a caption and the **REFEREE** reason (`components/social/feed/ProofPost.tsx`).
4. **LEAGUE**: **POT** $120, **PAID 6**, the standings table.
5. **Demo controls**, **End Week Now**. Then **LEAGUE** for **PAYOUTS**, and **ROSTER**, **Week Stats** for the recap.

Do not tap **Voice Draft**, **Submit Proof**, the Pay banner or **Trigger Quick-Time Drop** on this path. Each one calls a third party.
**End Week Now** skips Whop when nobody in the league paid through Whop (`settleWeek` in `convex/whop.ts`). It does queue a background memory write, which cannot block it.

## The stretch

The app shows the text number in the **Play by text** row: **LEAGUE** tab, under **NOTIFICATIONS**, and again on **Add Friends**. It reads "Get drops and send proofs by text at" followed by the number (`components/keiki/PlayByTextRow.tsx`).

- The number is a setting on the backend, not a value in the repository, so it is not printed here (`line` in `convex/keiki.ts`).
- The row is hidden when the backend has no number or join code set.
- Hold Phone A up on that row if a judge asks for the number. There is no larger display of it.
- A judge who texts from an unknown number gets "This number isn't linked to a Lineup account yet. In the app, tap Play by text and send the message it writes." (`reply.unknownNumber`).
- To appear on the board a judge needs the app, an account, the league (invite code `YCHACK`) and the opt-in text from that row. It is not a walk-up path.

## Known rough edges

Avoid these on stage.

- One draft per account per week. A second **Lock Lineup** in the same week writes next week's lineup, and a third fails with "Next week's lineup is already locked." (`lock` in `convex/lineup.ts`). **Reset Seed** does not clear the presenter's own lineup.
  In rehearsal, stop before **Lock Lineup**, or rehearse on a different account.
- **Reset Seed** removes the presenter from the league. Rejoin with `YCHACK` after every reset, and expect the Pay banner again.
- **End Week Now** is one-way. Only **Reset Seed** reopens the week. Tap it last.
- **Pin check-in here** is a demo control. It moves the pin to the phone, so step 5 shows the distance check working, not a pin set in advance. Say so if asked.
- Most payouts are ledger rows, not money moved. Seeded players never paid through Whop, and the sandbox refuses transfers from an unverified company (`settleWeek` in `convex/whop.ts`).
  A payout row reads "Paid on Whop" only when Whop accepted it (`payoutLine` in `lib/leagueText.ts`).
- Tap **Trigger Quick-Time Drop** once. A second tap closes the first drop, which stays on every roster as a missed task, and starts it again (`triggerQuickTime` and `failUnproven` in `convex/drops.ts`).
- **Send nudge now** texts this phone a check-in nudge, a different kind on each tap (`nudgeNow` in `convex/checkins.ts`). It is not part of this script.
- **Preview Drop Notification (5 s)** is a sample scheduled on the phone, not the live drop, and its text names a different gesture (`lib/notifications/preview.ts`). Do not present it as the drop.
- A texted photo cannot prove a location task. A text carries no GPS, so the reply asks for a check-in in the app unless the app saw the phone arrive in the last hour (`chooseProofTarget` in `convex/lib/keikiText.ts`).
- A standalone build may read the photo on the phone first and offer **Retake** or **Send anyway** (`components/onDeviceReferee/OnDeviceRead.tsx`). Tap **Send anyway** to get the referee's verdict. Expo Go never shows this.
- Thumbnails under the proof camera mean **Sample media** is on (`cameraScreen` in `components/capture/camera/cameraScreen.ts`). They are bundled photos that earn real points from the real referee, so keep the switch off on a real phone.
  On a cloud phone, **Push-ups** is the sample that fits the drop and **Wrong photo** shows a **NOT VERIFIED** verdict.
- A cloud phone has no camera, microphone or GPS. The three **DEVELOPMENT** switches stand in for them, and the draft and referee calls are still real.
- In Expo Go the permission prompts say Expo Go, not Lineup (`docs/demo/REAL_PHONE.md`).
- No acceptance check has a recorded pass. All eight rows in `docs/demo/ACCEPTANCE.md` read "not run" at this commit. Rehearse every step on the real phones.
