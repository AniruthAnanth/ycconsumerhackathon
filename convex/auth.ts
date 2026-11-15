import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Accounts are anonymous and bound to the device: the app signs in once and
// keeps the session in expo-secure-store. An anonymous account can't be signed
// into again once its session ends, so sessions last a year instead of the
// default 30 days.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
  session: {
    totalDurationMs: ONE_YEAR_MS,
    inactiveDurationMs: ONE_YEAR_MS,
  },
});
