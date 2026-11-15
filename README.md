# Lineup

A fantasy league for your own life. Players draft their week by voice, put money on it, and prove each task to their league with AI-verified photos. The interface is modelled on the ESPN Fantasy app.

**Stack:** Expo SDK 58 (Expo Router, TypeScript) at the repo root, Convex for the whole backend, Convex Auth with anonymous device-bound accounts stored in expo-secure-store. Everything installed runs in Expo Go; nothing needs a custom development build.

## Commands

```bash
npm ci                    # install
npx expo start            # run the app (Expo Go, or press w for web)
npx convex dev --once     # typecheck, deploy and regenerate convex/_generated (needs CONVEX_DEPLOY_KEY)
npm run typecheck         # tsc for the app, then for convex/
npm test                  # vitest
npx expo install <pkg>    # add an Expo package at the version SDK 58 expects
```

CI runs `npm ci`, `npm run typecheck` and `npm test` on every pull request.

## Environment

- `EXPO_PUBLIC_CONVEX_URL` is the only value the app reads. It is public, so it is committed in `.env`; override it in `.env.local` or the build environment.
- `CONVEX_DEPLOY_KEY` lets `npx convex dev --once` deploy without a login. Keep it in your shell or `.env.local`, never in git.
- Backend secrets live in the Convex deployment, not in files: `npx convex env set NAME "$NAME"` for `OPENAI_API_KEY`, `SUPERMEMORY_API_KEY`, `WHOP_API_KEY`, `WHOP_ENVIRONMENT`, `WHOP_WEBHOOK_SECRET` and `KEIKI_API_KEY`. They are declared in `convex/convex.config.ts`; read them through the typed `env` exported by `convex/_generated/server`.

## Layout

```
app/          Screens only: thin, no business logic. app/(tabs) holds ROSTER, MATCHUP, FEED and LEAGUE.
components/   Shared UI.
theme/        Design tokens: colours, spacing, hairline.
lib/          Client helpers (Convex client, token storage).
convex/       The backend, one module per domain.
```

Backend modules and who owns them:

| Area | Modules |
| --- | --- |
| Foundation | `schema.ts`, `auth.ts`, `auth.config.ts`, `convex.config.ts`, `lib/auth.ts` |
| Core backend | `users.ts`, `leagues.ts`, `lineup.ts`, `proofs.ts`, `standings.ts`, `feed.ts`, `profile.ts`, `wrapped.ts`, `seed.ts`, `challenges.ts`, `canvas.ts`, `ai.ts` (the only file that calls OpenAI), `memory.ts` (the only file that calls Supermemory), and `lib/` for pure functions with tests (`scoring.ts`, `settlement.ts`, `geo.ts`) |
| Integrations | `whop.ts`, `keiki.ts`, `http.ts`, `drops.ts`, `crons.ts` |

## Rules

- Every third-party API call lives in a Convex action. The app never imports `openai`, `supermemory`, `@whop/sdk` or a Keiki client, and never holds a key.
- Every public Convex function resolves its caller with `requireUser(ctx)` from `convex/lib/auth.ts`. It honours `users.demoActAs`, the demo's Switch Player control.
- `convex/schema.ts` is the contract between workstreams: new fields are optional and index names don't change.
- `convex/http.ts` only routes; handlers live in their domain module. `POST /whop` and `POST /keiki/turn` reject everything until their signature checks exist.
- Tests sit next to the code as `*.test.ts` under `convex/` or `lib/`.
- Mobile binaries are built on Revyl, never with a shell command.

## Data model in one paragraph

A player drafts one lineup per calendar week and it scores in every league they belong to, so lineups, tasks and proofs are keyed by `(userId, weekStart)`, not by league. `weekStart` is the epoch milliseconds of that week's Monday 00:00 in America/Los_Angeles, and each league's `weeks` row for that week has `startsAt` equal to it. A task with a `dropId` scores only in that drop's league.

See [hackathon.md](hackathon.md) for how Convex, Capy and Revyl are used.
