# Lineup at the YC Consumer Mobile Hackathon

Lineup is a fantasy league for your own life: draft your week by voice, put money on it, and prove each task to your league with AI-verified photos.

## Convex

Convex is the entire backend; there is no other server.

- **Database and live queries.** Leagues, lineups, tasks, proofs and the ledger live in Convex tables (`convex/schema.ts`). Standings are computed in queries, so a second phone updates the moment a proof is written.
- **Auth.** Convex Auth with the Anonymous provider gives every device an account with no password; the session is kept in expo-secure-store.
- **Actions.** Every third-party call (OpenAI for the voice draft and proof verification, Supermemory, Whop, Keiki) runs in a Convex action, so no key ever ships in the app.
- **HTTP actions.** `POST /whop` receives payment webhooks and `POST /keiki/turn` receives texted messages.
- **File storage, scheduler and crons.** Proof photos and draft audio go through upload URLs; drops, challenges and week settlement are scheduled functions.

## Capy

The app was built by a crew of Capy threads directed by one Captain: a foundation thread pushed this scaffold and the schema contract, then app, backend and integration threads worked in parallel, each in its own modules, shipping small pull requests gated by CI.

## Revyl

The machines that write the code have no iOS or Android toolchain. Every build runs on Revyl's cloud build runners and is installed on Revyl cloud phones, where each change is checked and the demo is recorded.
