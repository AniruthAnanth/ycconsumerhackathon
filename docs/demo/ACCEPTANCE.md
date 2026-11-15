# Acceptance checks (SPEC section 10)

Run on Revyl cloud iPhones from a standalone build of `main` (see [scripts/README.md](../../scripts/README.md)). A cloud simulator has no camera, microphone or GPS, so proofs use the app's sample photos, the draft uses a typed transcript, and location uses the fixed-coordinates setting. The owner confirms the real hardware with [REAL_PHONE.md](REAL_PHONE.md).

Status values: **pass**, **fail** (with the defect and the issue it was reported on), **blocked** (what it waits for), **not run**.

| # | Check | How it is run | Status |
| --- | --- | --- | --- |
| 1 | Two phones in the same league: a proof verified on one reorders standings on the other within two seconds, with no refresh. | Two cloud iPhones switched to different seeded players of "YC Hackathon" with Demo controls, Switch Player. Phone B stays on LEAGUE. Phone A submits a sample photo for an open task. Phone B is screenshotted before, and again inside two seconds of the verdict. | not run |
| 2 | The owner was told the webhook URL as soon as Convex deployed. | Read the Captain's thread for the message carrying `https://sensible-guineapig-9.convex.site/whop`. | not run |
| 3 | A Whop test payment marks the member paid and raises the pot without the app being reopened. | Tap the Pay banner, pay with 4242 4242 4242 4242 in the sandbox checkout, return to the app without relaunching it, and compare the pot and the paid list before and after. | not run |
| 4 | A photo texted to the Keiki number during a drop produces a verdict reply and a new feed item. | Trigger a quick-time drop from Demo controls, send a signed test turn with a photo to `POST /keiki/turn` as the seeded player's number, then read the reply and open FEED. The real text from a real phone is the owner's check. | not run |
| 5 | A photo of the wrong thing fails with a readable reason. | Submit the bundled "wrong photo" sample for a Body task. The verdict screen must read NOT VERIFIED with a reason a player can act on, and the task must stay open. | not run |
| 6 | End Week Now produces ledger rows that sum to the pot, and running it twice pays nobody twice. | Demo controls, End Week Now. Read the payouts on LEAGUE and the `ledger` table: refunds + winnings + fee = buy-ins. Run it again and confirm the row count and the payouts are unchanged. | not run |
| 7 | A fresh install reaches a locked lineup in under 90 seconds. | Install the build on a fresh phone session and time first frame to "lineup locked": name and phone, pick a league, typed transcript in Voice Draft, Lock Lineup. | not run |
| 8 | The owner has confirmed camera, microphone and location on a real phone. | The owner follows REAL_PHONE.md and reports on ANI-52. | not run |

Screenshots for each check are in the Captain's drive under `renders/YCCO-13/acceptance/`.
