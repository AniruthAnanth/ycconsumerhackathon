# Ten questions a judge will ask

Two-sentence answers to say aloud, hardest question first. Each was checked against main on November 15, 2026; the files named are where to look.

## 1. What stops someone from faking a proof?

**Answer:** A vision model describes each photo, but fixed rules in code make the call. A proof under 0.6 confidence fails, a location task needs the phone within 150 m, and any league mate can challenge a pass for 24 hours.

**Where it lives:** `convex/lib/verdict.ts` (`decideVerdict`), `convex/proofs.ts` (`runVerification`), `convex/challenges.ts` (`open`, `vote`).

**If pressed:** A staged photo can still pass: the server trusts the coordinates the app sends, nothing detects a reused photo, and only quick-time drops demand a random gesture (`GESTURES` in `convex/lib/dropRules.ts`); the league vote is the backstop.

## 2. Why does it need money?

**Answer:** The stake makes a skipped task cost something. Clear all five slots and your stake comes back; miss one and it goes to the players who finished, split by their points.

**Where it lives:** `convex/lib/settlement.ts` (`computeSettlement`), `convex/leagues.ts` (`quickMatch`).

**If pressed:** Free leagues run the same loop on points alone (`quickMatch` takes $0, $5 or $20), and there is no data yet on whether the stake changes what people finish.

## 3. Is it legal to play for real money?

**Answer:** That is not established, and it needs legal review before any real money moves. Today the backend refuses to call Whop outside its sandbox, so every dollar in the demo is test money.

**Where it lives:** `convex/whop.ts` (`whopClient`).

**If pressed:** What it is: friends each put a stake on their own tasks, get it back by finishing, and split the stakes of those who did not; the code has no age, identity or residency checks.

## 4. What does the AI actually do, and what happens when it is wrong?

**Answer:** It turns a voice note into a week's lineup and referees every proof, with a one-sentence reason the league reads. A wrong fail leaves the task open to retry all week, and a wrong pass can be challenged and overturned by a league vote.

**Where it lives:** `convex/ai.ts` (`draftLineup`, `judgeProof`), `convex/lib/verdict.ts` (`decideVerdict`), `convex/challenges.ts` (`decide`).

**If pressed:** The model is `gpt-6-luna`, with speech transcribed first by `gpt-transcribe` (both named in `convex/ai.ts`); a wrong fail has no appeal except a new photo, and a video is judged from at most three stills of a clip capped at 10 seconds (`convex/lib/clip.ts`).

## 5. How do you make money on a 10% fee?

**Answer:** The platform keeps 10% of forfeited stakes only, never of money returned to finishers. Six players at $20 is a $120 pot; if two miss, $40 is forfeited, the fee is $4, and the four finishers split $36 by points.

**Where it lives:** `convex/lib/settlement.ts` (`PLATFORM_FEE_RATE`, `computeSettlement`), `convex/lib/settlement.test.ts`, `convex/ai.ts` (`judgeProof`).

**If pressed:** $4 is 3.3% of that pot and the fee is $0 when everyone finishes or nobody does, so revenue depends on some players failing; the main cost is one `gpt-6-luna` vision call per proof, five to eight per player per week before retries, and its price has not been measured.

## 6. Why would anyone open it every day?

**Answer:** Roster shows one Up Next task with the camera one tap away. A streak bonus pays for proving something each day, and the leaderboards name your rival and the gap.

**Where it lives:** `convex/lineup.ts` (`roster`), `convex/lib/ranking.ts` (`rankBoard`).

**If pressed:** There are no push notifications: evening nudges, lead changes and "you were passed" go by text, only to players who opted in (`convex/checkins.ts`, `convex/leadChange.ts`, `phonesOf` in `convex/keiki.ts`).

## 7. How does a league grow?

**Answer:** There are three ways in: a six-character invite code, your contacts, or Quick Match into a public league at Free, $5 or $20. Contacts already on Lineup are added to your league, and the rest get the code by text from your own phone.

**Where it lives:** `convex/leagues.ts` (`joinByCode`, `quickMatch`), `convex/users.ts` (`matchContacts`), `app/contacts.tsx` (`sendInvites`).

**If pressed:** A league holds at most 12 members (`MAX_MEMBERS` in `convex/leagues.ts`), the invite is a code and not a link, and a matched contact is added without being asked first.

## 8. What happens to my contacts and my location?

**Answer:** Only normalised phone numbers leave the device, and the server stores nothing about contacts who are not on Lineup. Location is read only while the app is open, and it is saved with a proof, an arrival at a task's pinned place, or a group session pin you set.

**Where it lives:** `lib/phone.ts` (`collectContactPhones`), `convex/users.ts` (`matchContacts`), `convex/checkins.ts` (`recordArrival`).

**If pressed:** Numbers are matched in plain form, not hashed; a proof carries coordinates whenever location permission is already on (`resolveCaptureCoords` in `components/capture/camera/captureCoords.ts`); the number typed at sign-up is not verified (`createUser` in `convex/users.ts`); and there is no delete-my-account function.

## 9. What happens if someone does not pay, or stops playing?

**Answer:** An unpaid member plays fully and sees a Pay banner, but puts nothing in and takes nothing out. A paid member who stops proving forfeits their stake to the finishers, less the 10% fee, and if nobody finishes every stake is refunded.

**Where it lives:** `convex/lib/settlement.ts` (`computeSettlement`), `convex/whop.ts` (`recordBuyIn`), `components/roster/PayBanner.tsx`.

**If pressed:** In a stake league only Whop's signed webhook marks a member paid (`whopWebhook` in `convex/whop.ts`), and there is no way to leave or be removed from a league, so a player who quits stays on the schedule.

## 10. What did you build today, and what is mocked?

**Answer:** The loop is real code on main: voice draft, lock, sandbox buy-in, refereed proofs, feed, challenges, standings and settlement, with every third-party call inside a Convex action. The demo league is seeded, and hidden demo controls switch players, start a drop and end the week on demand.

**Where it lives:** `convex/seed.ts` (`reset`, `actAs`), `components/capture/demo/DemoControls.tsx`, `convex/whop.ts` (`settleWeek`).

**If pressed:** The demo controls ship ungated behind a long press (`app/demo/index.tsx`), so anyone who finds them can switch player, override location or end the week; they have to come out before real play.

## What we would not claim

- **That real money moves, or that real-money play is legal.** Whop is sandbox only, and `settleWeek` in `convex/whop.ts` expects Whop to refuse transfers out of a sandbox league, so payouts and the fee are ledger rows.
- **An Apple Watch app or background geofencing.** The repository has no watch code, only a concept slide (`scripts/slides/README.md`); location uses the when-in-use permission (`app.json`) and is re-read only while the app is open (`components/checkin/useForegroundCoords.ts`).
- **A week that ends and pays out on its own, or drops on a schedule.** `convex/crons.ts` runs one job, the hourly check-in texts; settlement (`settleWeek` in `convex/whop.ts`) and quick-time drops (`triggerQuickTime` in `convex/drops.ts`) start from the demo controls.
- **An on-device AI check, or proving a location task by text.** `modules/on-device-referee` has no native code on main, so `precheck` in `lib/onDeviceReferee.ts` returns nothing; `rejectionBeforeJudging` in `convex/proofs.ts` refuses every texted proof of a location task, even after an arrival.
