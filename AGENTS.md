# Lineup

Read README.md for the layout, the commands and the rules every change follows.

- Expo SDK 58 ships APIs newer than most training data. Read the versioned docs at https://docs.expo.dev/versions/v58.0.0/ before using an Expo or React Native API, and add packages with `npx expo install`.
- Keep the app runnable in Expo Go: add no library that needs a custom development build. expo-av no longer exists; use expo-audio and expo-video.
- Routes live in `app/`; keep components, hooks and helpers out of it.
- Convex Auth is pinned to 0.0.98 because 2.x has no anonymous sign-in. Follow https://labs.convex.dev/auth for that version, not the convex-auth skill, which describes 2.x.
- After every backend change run `npx convex dev --once` and fix every error, then `npm run typecheck` and `npm test`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
