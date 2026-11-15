/**
 * Two decisions about a notification the phone already has: how to show it while the app is
 * open, and where a tap on it goes. Pure, so both are tested without a device.
 */
import { PASS_ACTION, type NotificationKind } from "@/convex/lib/notificationContent";

/** The fields Lineup puts in a notification's data, as they come back from the system: unchecked. */
export type Incoming = { id?: string; kind?: string; url?: string };

/** Reads Lineup's fields out of a notification's data, ignoring anything that is not a string. */
export function incomingOf(data: Record<string, unknown> | null | undefined): Incoming {
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  return { id: text(data?.id), kind: text(data?.kind), url: text(data?.url) };
}

/**
 * alert: a banner with sound. quiet: kept in Notification Centre, no banner and no sound.
 * none: not shown at all.
 */
export type Presentation = "alert" | "quiet" | "none";

/**
 * The kinds the league agent also texts (the drop, challenge and check-in senders in convex/).
 * A player with texts on has already been alerted to these by the text.
 */
const ALSO_TEXTED: ReadonlySet<string> = new Set<NotificationKind>(["drop", "challenge", "rival", "nudge"]);

/**
 * The app raises a notification from its own queries and the backend may push the same one.
 * A second copy inside this window is the same news arriving by the other road.
 */
export const DUPLICATE_WINDOW_MS = 60 * 1000;

/**
 * How a notification that arrives while the app is open is shown. iOS shows nothing in the
 * foreground unless the app says so, which makes this the one place every notification, local
 * or pushed, is judged.
 */
export function presentationFor(
  incoming: Incoming,
  context: { pathname: string; textsOn: boolean; lastShownAt: number | undefined; now: number },
): Presentation {
  if (context.lastShownAt !== undefined && context.now - context.lastShownAt < DUPLICATE_WINDOW_MS) return "none";
  // Demo controls is the presenter's screen, and Roster stays live underneath it. Switching
  // player there makes Roster announce the new player's arrival; the banner lands on the header,
  // and the tap meant for Back opens the banner's screen instead. Kept, but without a banner.
  if (context.pathname === "/demo") return "quiet";
  // The proof screens are already showing this ruling, with more of it than a banner holds.
  if (incoming.kind === "verdict" && context.pathname.startsWith("/proof")) return "none";
  // One alert per event: with texts on the text is the alert, and the app only keeps the record.
  if (context.textsOn && incoming.kind !== undefined && ALSO_TEXTED.has(incoming.kind)) return "quiet";
  return "alert";
}

/**
 * The screen a response opens, or null when it opens nothing: Pass dismisses, and so does a
 * notification that names no screen. A push can carry any string, so only paths inside the
 * app are followed, never a full URL.
 */
export function urlToOpen(actionIdentifier: string, incoming: Incoming): string | null {
  if (actionIdentifier === PASS_ACTION) return null;
  const url = incoming.url;
  return url !== undefined && url.startsWith("/") && !url.startsWith("//") ? url : null;
}
