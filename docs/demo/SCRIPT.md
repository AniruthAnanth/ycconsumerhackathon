# The two-minute demo script

Two phones, six steps, about 120 seconds. On-screen labels are in **bold**, spelled as the app shows them. The line labels in each step (**Time:**, **Tap:** and so on) are this script's own.

Checked against `main` at commit `b396a71` on November 15, 2026. If a label here is not on the screen, trust the screen.

- Phone A is the presenter's phone, signed in as the presenter's own account.
- Phone B is the league's view. It acts as the seeded player Sam Patel and stays on **LEAGUE**.

Demo controls open with a long press (about one second) on the week label, **Week 5**, under the tabs.
Source: `app/(tabs)/_layout.tsx`, `components/ui/WeekSelector.tsx`, `components/capture/demo/DemoControls.tsx`.

## Before you walk up

Run this top to bottom. It takes under a minute once the permissions are granted.

1. Reset the league. Either phone: **Demo controls**, tap **Reset Seed**, wait for **DONE**.
   It restores "YC Hackathon": six seeded players, all paid, week 5 (`restoreSeed` in `convex/seed.ts`).
2. Rejoin on Phone A. Reset removes every member who is not one of the six (`clearLeague` in `convex/seed.ts`).
   Phone A lands on **Join a League**. Under **INVITE CODE**, type `YCHACK` in **CODE** and tap **Join**.
   If Phone A is in another league it stays on the tabs: tap the league name in the header, then **Join or create a league**.
3. Get back to the roster. Joining opens **Add Friends**: tap **Skip**. That opens **Voice Draft**: tap the back chevron.
4. Phone A plays as itself. **Demo controls**, under **SWITCH PLAYER**: **PLAYING** is beside **Me**. If not, tap **Me**.
5. Phone A's roster is empty. It shows five **Empty** rows, the **Draft your week** button and the banner **Pay your $20 buy-in**.
   If it already lists tasks, read "Known rough edges" before going on.
6. Opt in to texts on Phone A. **LEAGUE** tab, **Play by text** row, turn the switch on. Messages opens with a text typed: send it.
   Wait for the reply "You're connected. Drops and verdicts land here..." (`reply.welcome` in `convex/lib/keikiText.ts`).
   Nobody is texted without this (`phonesOf` in `convex/keiki.ts`). Do it before the demo, not on stage.
7. Phone B becomes Sam. **Demo controls**, under **SWITCH PLAYER**, tap **Sam Patel**. **PLAYING** moves to that row.
8. Park Phone B on the league tab. It shows **POT** $120, **PAID 6**, **UNPAID 1** and the presenter's row tagged **Unpaid**.
9. Permissions on Phone A. Microphone is asked on the first recording, camera on the first proof, location when a location task's camera opens (`requestLocationFor` in `components/capture/camera/deviceLocation.ts`).
   Grant them in rehearsal. In iPhone Settings check Camera, Microphone, Location and Precise Location are on for the app (`docs/demo/REAL_PHONE.md`).
10. Development switches off on a real phone. **Demo controls**, under **DEVELOPMENT**: **Sample media**, **Sample voice note** and **Location override** are off.
    They return to the build's default every time the app restarts (`lib/devFlags.ts`).
11. Test card. 4242 4242 4242 4242, any future date, any CVC (`docs/demo/REAL_PHONE.md`, test 6). Whop runs in the sandbox only (`whopClient` in `convex/whop.ts`).
12. Quiet phones. Do Not Disturb on Phone B. On Phone A allow Messages, because the drop text must show.
13. Screen lock off. Both phones: iPhone Settings, Display & Brightness, Auto-Lock, Never.
14. Starting screens. Phone A on **ROSTER**. Phone B on **LEAGUE**.

## The script

### 1. Speak the week

- **Time:** 25 seconds.
- **Tap:** **ROSTER**, **Voice Draft**. Tap the round record button (it has no text), speak, tap it again to stop.
  **LISTENING** shows, then **DRAFTING**, then your words, then **LINEUP**. Tap **Lock Lineup**. Roster fills.
- **Speak:** "Leg day at the gym, finish my problem set, read thirty minutes, laundry, call my mom, and check in at the YC office."
  Name the YC office: the draft pins that place only when you say it (`convex/ai.ts`), and step 5 needs it.
- **Phone B shows:** no change. A draft scores nothing until a proof is verified.
- **Say:** "I say my week out loud and it becomes a lineup, one task per slot."
- **If it is slow:** keep talking while **DRAFTING** shows. If the red line "Couldn't draft your week. Try again." appears, record again.
  If the microphone fails, a **YOUR WEEK** box and **Draft from text** appear on their own (`micUnavailable` in `components/capture/draft/draftState.ts`). Type one line and tap it.
  Both paths call the same model. If neither returns, go to step 2: the drop in step 3 still gives you a task to prove.

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
  The text on Phone A reads: "Quick-time: [task] in the next 2 hours, [gesture] in the photo. +[points]. Reply with a photo." (`quickTimeText` in `convex/lib/dropRules.ts`).
  The task and the gesture are picked at random (`pickQuickTime`), so read the text before you act.
- **Phone B shows:** nothing on **LEAGUE**. The drop is a banner on Phone B's **ROSTER**, with a countdown and **Submit**.
- **Say:** "Any time in the week the league gets a surprise task by text. Here it is."
- **If it is slow:** the same drop is already a banner at the top of Phone A's **ROSTER**, and it does not depend on the text.
  Show it and say: "The text is on its way. The drop is live in the app."

### 4. Reply with a photo

- **Time:** 25 seconds.
- **Tap:** in Messages on Phone A, reply to the drop text with a photo of the task. Show the gesture in the photo.
  The reply reads "Verified, +[points]. [reason] You're [rank], [gap] behind [name]." (`reply.verdict` and `rankLine` in `convex/lib/keikiText.ts`).
- **Phone B shows:** on **LEAGUE** the presenter's row gains points and moves up. A new post appears on **FEED**.
  Convex pushes the change. Acceptance check 1 sets a two-second target and is marked "not run" (`docs/demo/ACCEPTANCE.md`).
- **Say:** "An AI referee checks the photo and tells me why. The table just moved on the other phone."
- **If it is slow:** prove it in the app. Phone A, **ROSTER**, drop banner, **Submit**, take the photo. **REFEREE REVIEWING** shows, then the **VERIFIED** stamp, the reason and **Done**.
  It is the same referee (`convex/proofs.ts`). On **NOT VERIFIED**, read the reason aloud and tap **Retry**: the task stays open.

### 5. Check in at the YC office

- **Time:** 20 seconds.
- **Tap:** **ROSTER**, the YC office task (its row reads **Photo + location** and "@" with the place name). On **Task**, tap **Submit Proof**, take the photo, read the reason on the verdict screen, tap **Done**.
  If a line tagged **HERE** with a **Check In** button is at the top of Roster, tap that instead: it opens the same camera.
  The **HERE** line needs location already allowed and the phone within 30 m of the pin. It works only while the app is open (`components/checkin/useForegroundCoords.ts`, `ARRIVAL_METERS` in `convex/lib/checkinRules.ts`).
  The proof passes within 150 m of the pin (`CHECK_IN_RADIUS_M` in `convex/lib/geo.ts`).
- **Phone B shows:** the presenter's points rise on **LEAGUE**, and the post on **FEED** carries the **REFEREE** line.
- **Say:** "This task is pinned to this building. GPS proves I'm here, the photo proves I did it."
- **If it is slow:** do not fight GPS on stage. If the verdict reads "You're [distance] from [place]. Check in within 150 m." or the draft made no location task, use the seeded one.
  Phone B, **FEED**, Priya Shah's "Morning run at Dolores Park". Its referee line ends "checked in at Dolores Park." Say: "Here's one from earlier this week."
  On a cloud phone only: **Demo controls**, **Location override** on, **At the place**, then retake. Say out loud that the location is fixed for the simulator.

### 6. End the week

- **Time:** 15 seconds.
- **Tap:** long-press **Week 5**, **End Week Now**, wait for **DONE**, back chevron. **LEAGUE**: a **PAYOUTS** section lists **Refund** and **Winnings** rows.
  Then **ROSTER**, **Week Stats**. Tap the right side to step through five cards, ending on **Your week**. The cross closes it.
- **Phone B shows:** **PAYOUTS** appears on **LEAGUE** at the same moment.
- **Say:** "Clear your five slots and you keep your stake. Whoever cleared them splits what the rest forfeit."
- **If it is slow:** the payout rows are written before any Whop call (`closeWeek` runs first in `settleWeek`, `convex/whop.ts`). Open **LEAGUE** without waiting for **DONE**.
  **Week Stats** opens the recap for the current week whether or not it has settled (`pickWeek` in `convex/wrapped.ts`), so show it either way.

Time adds up to 120 seconds: 25, 20, 15, 25, 20, 15.

## If everything fails

This path reads seeded data only. It makes no call to Whop, Keiki or OpenAI.

1. Phone A: **Demo controls**, **Reset Seed**, then **Sam Patel** under **SWITCH PLAYER**.
2. ROSTER: Sam's week. Four starters verified, "Call mom" open, and the drop task "20 push-ups" under **FLEX AND BONUS**.
3. FEED: seeded proofs, each with a photo, a caption and the **REFEREE** reason (`components/social/feed/ProofPost.tsx`).
4. LEAGUE: **POT** $120, **PAID 6**, the standings table.
5. Demo controls, **End Week Now**. Then **LEAGUE** for **PAYOUTS**, and **ROSTER**, **Week Stats** for the recap.

Do not tap **Voice Draft**, **Submit Proof**, the Pay banner or **Trigger Quick-Time Drop** on this path. Each one calls a third party.
**End Week Now** skips Whop when no member has a Whop account to pay (`unsentTransfers` and `settleWeek` in `convex/whop.ts`). It does queue a background memory write, which cannot block it.

## The stretch

The app shows the text number in one place: **LEAGUE** tab, **Play by text** row. It reads "Get drops and send proofs by text at" followed by the number (`components/keiki/PlayByTextRow.tsx`).

- The number is a setting on the backend, not a value in the repository, so it is not printed here (`line` in `convex/keiki.ts`).
- The row is hidden when the backend has no number or join code set.
- Hold Phone A up on that row if a judge asks for the number. There is no larger display of it.
- A judge who texts from an unknown number gets "This number isn't on Lineup yet. Sign up with it in the app, then text me again." (`reply.unknownNumber`).
- To appear on the board a judge needs the app, an account, the league (invite code `YCHACK`) and the opt-in text from that row. It is not a walk-up path.

## Known rough edges

Avoid these on stage.

- One draft per account per week. A second **Lock Lineup** in the same week writes next week's lineup, and a third fails with "Next week's lineup is already locked." (`lock` in `convex/lineup.ts`). **Reset Seed** does not clear the presenter's own lineup.
  In rehearsal, stop before **Lock Lineup**, or rehearse on a different account.
- **Reset Seed** removes the presenter from the league. Rejoin with `YCHACK` after every reset, and expect the Pay banner again.
- **End Week Now** is one-way. Only **Reset Seed** reopens the week. Tap it last.
- **POT** still reads "Settles in..." after **End Week Now**. The label follows the week's calendar end (`pot` in `convex/standings.ts`, `components/leagueTab/PotSummary.tsx`). Point at **PAYOUTS**.
- Payouts are ledger rows, not money moved. Seeded players have no Whop account, and Whop's sandbox refuses transfers from an unverified company (`settleWeek` in `convex/whop.ts`).
- Tap **Trigger Quick-Time Drop** once. A second tap closes the first drop and starts another with a different task (`triggerQuickTime` in `convex/drops.ts`).
- A texted photo cannot prove a location task. A text carries no GPS, so the reply asks for a check-in in the app unless the app saw the phone arrive in the last hour (`chooseProofTarget` in `convex/lib/keikiText.ts`).
- Thumbnails in the camera mean no camera. If **Gym**, **Desk**, **Clean room**, **Wrong photo** and **Video** show under the proof camera, the camera permission is missing or **Sample media** is on (`components/capture/camera/ProofCamera.tsx`).
  They are bundled sample photos. **Wrong photo** is there to show a **NOT VERIFIED** verdict.
- A cloud phone has no camera, microphone or GPS. The three **DEVELOPMENT** switches stand in for them, and the draft and referee calls are still real.
- In Expo Go the permission prompts say Expo Go, not Lineup (`docs/demo/REAL_PHONE.md`).
- No acceptance check has a recorded pass. All eight rows in `docs/demo/ACCEPTANCE.md` read "not run" at this commit. Rehearse every step on the real phones.
