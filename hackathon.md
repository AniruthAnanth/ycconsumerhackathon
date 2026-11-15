# Lineup at the YC Consumer Mobile Hackathon

Lineup is a fantasy league for your own life. Each week you draft your tasks by voice into five slots (body, mind, recharge, chores, people), put a stake on them with your league, and prove each one with a photo that an AI referee checks. Clear all five and you get your stake back, plus a share of the stakes of the players who did not finish.

This page says how Convex, Capy and Revyl were each used, with the file to open for every claim. Engineering detail is in:

| Read | For |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | One diagram, the boundary rules, and a paragraph on every module. |
| [docs/SCHEMA.md](docs/SCHEMA.md) | Every Convex table, its indexes and why each exists. |
| [docs/SCORING.md](docs/SCORING.md) | The scoring, referee and settlement rules. |

## The numbers

Counted on `main` at commit `a5a0f89`, 2:17 PM Pacific on November 15, 2026. The first commit landed at 11:46 AM.

| | Count | Where |
| --- | --- | --- |
| Capy threads | 27: one Captain and a crew of 26 | |
| Subagents started by those threads | 138 | |
| Pull requests | 394 opened, 388 merged, 5 closed unmerged, in 149 minutes | every one opened by a crew thread |
| Time from opening a pull request to merging it | 1.6 minutes at the median, 4.1 at the 90th percentile | `.github/workflows/ci.yml` gates each one |
| Convex tables and indexes | 23 and 38 | `convex/schema.ts` |
| Convex public functions | 60: 23 queries, 30 mutations, 7 actions | `convex/*.ts` |
| Convex internal functions | 70 | `convex/*.ts` |
| HTTP actions and cron jobs | 3 and 2 | `convex/http.ts`, `convex/crons.ts` |
| Tests | 1,326 in 105 files | `npm test` |
| Device acceptance checks | 8 defined: 6 pass, 1 passes in the browser build but is blocked on the cloud iPhone, 1 waits on the owner's real phone | `docs/demo/ACCEPTANCE.md` |

## Convex

Convex is the whole backend. There is no other server, database or job queue.

- **Live queries are the product.** Standings are never stored. `convex/standings.ts` recomputes the league table from tasks, proofs, challenges and ledger rows inside a query, so when a proof is verified on one phone the League tab on every other phone reorders without a refresh. `convex/leaderboards.ts` does the same for the week in play and reads finished weeks from stored `scores` rows through an index.
- **One referee path.** A proof sent from the app (`proofs.verify`) and a photo texted to the league agent (`internal.proofs.verifyForUser`) run the same code in `convex/proofs.ts`: the model describes the photo, pure code in `convex/lib/verdict.ts` decides, and one mutation writes the proof row and scores the task.
- **Every outside call is a Convex action.** OpenAI is called only from `convex/ai.ts`, Supermemory only from `convex/memory.ts`, Whop only from `convex/whop.ts`, Keiki only from `convex/keiki.ts` and `convex/keikiMedia.ts`, the Canvas school API only from `convex/canvas.ts`, and Expo's push service only from `convex/push.ts`. The app imports none of their SDKs and holds no key.
- **HTTP actions take the two webhooks and one page.** `POST /whop` receives Whop's payment event and `POST /keiki/turn` receives each texted message. Each handler checks the signature before it reads the body and answers 401 when the check fails (`whopWebhook` in `convex/whop.ts`, `keikiTurn` in `convex/keiki.ts`). A third route, `GET /i/<token>`, serves the page a texted invite link opens (`invitePage` in `convex/referrals.ts`). `convex/http.ts` only routes.
- **The scheduler replaces a job server.** A quick-time drop opens and closes on time with `ctx.scheduler.runAt` (`convex/drops.ts`). A challenge vote closes itself 12 hours after it opens (`convex/challenges.ts`). A passing proof schedules the leaderboard refresh, the lead-change text and the check-in nudge (`convex/proofs.ts`). Two hourly crons are declared in `convex/crons.ts`. One sweeps for check-in nudges. The other (`leagues.sweepEndedWeeks`) settles each league whose week is over and opens its next week, and settling schedules `drops.closeForWeek` to close that week's drops.
- **File storage.** Proof photos, short videos and the voice note go straight from the phone to an upload URL (`proofs.generateUploadUrl`, `components/capture/uploadToConvex.ts`). A photo texted to the agent is downloaded and stored by `convex/keikiMedia.ts`, the one Node action, because it converts iPhone HEIC photos to JPEG.
- **Auth with no sign-up.** Convex Auth's Anonymous provider (`convex/auth.ts`) gives each device an account with no password, and the session is kept in the keychain (`lib/tokenStorage.ts`). Queries and mutations resolve the caller through `convex/lib/auth.ts`; an action does it through an internal query first.
- **Typed environment.** Every secret the backend reads is declared in `convex/convex.config.ts` and read through the typed `env`. None is in the repository or the app.
- **Rules as pure functions.** Scoring, settlement, the week, distance, verdict thresholds and league schedules are pure functions in `convex/lib/`, each with a test file beside it. Seventeen more suites run the real handlers against an in-memory backend with `convex-test`.

## Capy

The code on main was written by a crew of Capy threads, each a separate agent on its own cloud machine.

- **One Captain, a crew of 19.** The Captain thread wrote four files to a shared drive before any code existed: the brief, the owner's decisions, the contract between the app and the backend (every function name and shape), and a roster of which thread owns which files. Then it started one thread per stream: foundation, three for the backend, three for integrations (Whop, Keiki, drops), three for the app, and one each for device checks, leaderboards, league formats, check-ins, the on-device pre-check, demo imagery, these documents, code review and flow testing in the browser.
- **A contract first.** The foundation thread pushed the scaffold and `convex/schema.ts` as the only direct commit to main. After that the contract let app and backend threads build both sides of a function at the same time.
- **Ownership by file.** A thread touches only the files its roster row names, and a change to a shared file goes in its own small pull request. That is what let 20 threads merge into one repository about three times a minute without overwriting each other.
- **Small pull requests, merged on green.** Each pull request carries one piece of behaviour and merges as soon as CI passes install, typecheck and the full test suite. The counts are in the table above.
- **Subagents for parallel pieces.** Threads split their own stream across subagents on fresh machines: 72 so far, six of them writing the documents linked from this page.
- **Roles that are not features.** One thread keeps main green and deployed: it re-runs typecheck, tests, a Convex deploy and an iOS bundle from main about every ten minutes. One reviews structure, naming and index use. One walks every flow in a browser and reports defects to the owning thread.
- **Issues wake the owner.** There is one issue per stream under one parent. A defect found on a device is a comment on the owning stream's issue that mentions its thread, which wakes that thread to fix it.
- **One shared Convex deployment.** Every thread deploys to the same dev deployment, so the rule is: rebase on main, deploy, and redeploy from main after a merge.

## Revyl

The machines that write the code have no Xcode. Every binary is built on Revyl's cloud runners and every device check runs on a Revyl cloud iPhone.

- **One build recipe.** `scripts/build-ios-sim.sh` makes a Release build for the iOS Simulator with the JavaScript bundled and the Convex URL set at build time. Capy's mobile build tool, Revyl's pull-request profile and a developer's Mac all run that same script ([scripts/README.md](scripts/README.md)). The first build from main took about four minutes and launched on a cloud iPhone 18 Pro, signed in against the live Convex deployment.
- **Proof of changes on pull requests.** `.revyl/config.yaml` turns on Revyl's pull-request check: a pull request labelled `revyl-proof` is built, installed on a cloud iPhone and exercised, with a launch check that always runs. It is label-gated on purpose, because a ten-minute build on every pull request would have held back merges that take under two minutes.
- **Standing in for sensors.** A cloud simulator has no camera, microphone or GPS. A build flag (`EXPO_PUBLIC_DEV_FLAGS=1`, read in `lib/devFlags.ts`) offers bundled sample photos, a typed transcript and fixed coordinates in their place, and the result still goes through the real draft and referee paths on Convex.
- **Acceptance checks.** The eight checks from the brief are listed with how each is run and its status in [docs/demo/ACCEPTANCE.md](docs/demo/ACCEPTANCE.md). The real camera, microphone and GPS are the owner's check on their own iPhone ([docs/demo/REAL_PHONE.md](docs/demo/REAL_PHONE.md)).

## Whop, Keiki, OpenAI and Supermemory

- **Whop** carries the money. Each league is its own Whop company, a buy-in is a hosted checkout on that company, and only the verified webhook marks a member paid (`convex/whop.ts`). The split is a pure function in `convex/lib/settlement.ts`. The rules are in [docs/SCORING.md](docs/SCORING.md).
- **Keiki** is the league's text agent. A player who opts in can prove a task by texting a photo, and the league gets drops, lead changes and nudges as texts (`convex/keiki.ts`).
- **OpenAI** does three jobs from one file, `convex/ai.ts`: it transcribes the voice note, turns the transcript into a lineup, and describes proof photos for the referee.
- **Supermemory** keeps each player's past weeks in a namespace of their own (`convex/memory.ts`), so the next draft can react to what they finished and what they skipped.

## What does not work yet

- **Payouts stay in the ledger.** Whop's sandbox refuses a transfer out of a league company that has not passed identity verification, so settlement records every refund and winning in the `ledger` table and retries the transfers (`settleWeek` in `convex/whop.ts`).
- **Texting is one-to-one on a shared number.** The shared number has no group chats, so a league text goes to each member separately, and the agent can only text someone who has texted it first (`convex/keiki.ts`).
- **Location prompts need the app open.** The arrival prompt runs in the foreground only; a background geofence would need a custom build (`components/checkin/useForegroundCoords.ts`).
- **The on-device pre-check is not in Expo Go.** It exists only in a standalone iOS build and never awards points (`lib/onDeviceReferee.ts`).
- **There is no Apple Watch app.** Drops and verdicts reach a watch as ordinary message notifications.
