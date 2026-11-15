import { useMutation, useQuery } from "convex/react";
import { type Href, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { eventsBetween, readyToSchedule, scheduledFor, type Snapshot } from "@/lib/notifications/events";
import { onLineupLocked } from "@/lib/notifications/lineupLock";
import * as device from "@/lib/notifications/native";
import { presentationFor } from "@/lib/notifications/rules";
import { usePermission } from "@/lib/notifications/usePermission";

import { SilentBoundary } from "./SilentBoundary";

/**
 * Lineup's notifications while the app is running. It draws nothing. It watches the queries the
 * tabs already subscribe to and turns each change that is news to this player into a
 * notification, keeps the evening and settlement reminders scheduled, asks for permission once
 * a lineup is locked, and opens the right screen when a notification is tapped.
 *
 * None of this needs a push service, so it works in Expo Go and on a simulator. The push path
 * (convex/push.ts) carries the same notifications when the app is closed, for a device that
 * has a token.
 *
 * Mounted once, inside CurrentLeagueProvider. Where the device can't notify (the web) it
 * mounts nothing at all.
 */
export function NotificationsHost() {
  if (!device.isAvailable()) return null;
  return (
    <SilentBoundary>
      <Notifier />
    </SilentBoundary>
  );
}

/** Long enough for the screen that follows Lock Lineup to settle before a system dialog covers it. */
const ASK_AFTER_LOCK_MS = 1500;

function Notifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { me, leagueId, membership } = useCurrentLeague();
  const playing = me != null && leagueId !== null;
  const inLeague = playing ? { leagueId } : "skip";

  const settings = useQuery(api.push.settings, me ? {} : "skip");
  const drops = useQuery(backend.drops.active, inLeague);
  const roster = useQuery(backend.lineup.roster, inLeague);
  const standings = useQuery(backend.standings.table, inLeague);
  const pot = useQuery(backend.standings.pot, inLeague);
  const feed = useQuery(api.feed.list, inLeague);

  const permission = usePermission();
  useAskAfterLock(permission);
  // Undefined until the system's answer and the Push switch have both been read: not knowing
  // yet is not the same as off, and the reminders below must be able to tell the two apart.
  const enabled =
    permission === undefined || settings === undefined ? undefined : permission === "granted" && settings.pushOn;
  useEffect(() => device.setEnabled(enabled === true), [enabled]);

  // The foreground handler is registered once and outlives renders, so what it needs to know
  // about the current screen and settings is kept where it can read the latest value.
  const textsOn = settings?.textsOn === true;
  const screen = useRef({ pathname, textsOn });
  useEffect(() => {
    screen.current = { pathname, textsOn };
  }, [pathname, textsOn]);
  useEffect(() => {
    const shownAt = new Map<string, number>();
    device.presentInForeground((incoming) => {
      const now = Date.now();
      const lastShownAt = incoming.id === undefined ? undefined : shownAt.get(incoming.id);
      const how = presentationFor(incoming, { ...screen.current, lastShownAt, now });
      if (how !== "none" && incoming.id !== undefined) shownAt.set(incoming.id, now);
      return how;
    });
  }, []);

  // A tap can be what launched the app. Its screen is opened once the player's own screens
  // exist to open it over; before that the tabs would redirect to onboarding. navigate, not
  // push: a tab is switched to rather than stacked, and the screen already showing stays one.
  useEffect(() => {
    if (!playing) return;
    return device.onOpen((url) => router.navigate(url as Href));
  }, [playing, router]);

  const userId = me?._id;
  const leagueName = membership?.name;
  const snapshot = useMemo<Snapshot | null>(
    () =>
      userId && leagueId
        ? { userId, leagueId, leagueName: leagueName ?? "Your league", drops, roster, standings, feed, pot }
        : null,
    [userId, leagueId, leagueName, drops, roster, standings, feed, pot],
  );

  // Each new snapshot is compared with the one before it. The comparison is made even while
  // notifications are off, so switching them on never replays what happened in the meantime.
  const previous = useRef<Snapshot | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const events = eventsBetween(previous.current, snapshot, Date.now());
    previous.current = snapshot;
    for (const event of events) void device.raise(event);
  }, [snapshot]);

  // syncScheduled cancels every pending reminder that is not in the list it is given, so it is
  // only handed a list that can be trusted: the queries the reminders are worked out from have
  // loaded (readyToSchedule), and it is known whether notifications are on. Acting sooner
  // cancelled the reminders at every launch and scheduled them again a moment later, and lost
  // them for good when the app was closed in between. Once all of it is known, off still
  // cancels them.
  useEffect(() => {
    if (!snapshot || enabled === undefined || !readyToSchedule(snapshot)) return;
    void device.syncScheduled(scheduledFor(snapshot, Date.now()));
  }, [snapshot, enabled]);

  // The push path: hand the backend this device's token when it has one. In Expo Go and on a
  // simulator there is none, and nothing is registered.
  const registerToken = useMutation(api.push.registerToken);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void device.expoPushToken().then((token) => {
      if (token !== null && current) registerToken({ token }).catch(() => {});
    });
    return () => {
      current = false;
    };
  }, [enabled, registerToken]);

  return null;
}

/**
 * Puts the system's question, "may Lineup notify?", once: just after the player locks a
 * lineup. By then they have a week worth being told about, where a dialog on first launch
 * would mostly be answered No. The answer is not kept here: requestPermission publishes it,
 * and usePermission hands it to this host and to the Push switch alike.
 */
function useAskAfterLock(permission: device.Permission | undefined): void {
  // The lock is the one Lock Lineup announces (lineupLock.ts), never one read off the roster
  // query: that query also turns locked when the player locked nothing, as under Switch Player.
  // So a lineup that was already locked when the app opened says nothing about this moment.
  const [justLocked, setJustLocked] = useState(false);
  useEffect(() => onLineupLocked(() => setJustLocked(true)), []);

  useEffect(() => {
    if (!justLocked || permission !== "undetermined") return;
    const timer = setTimeout(() => void device.requestPermission(), ASK_AFTER_LOCK_MS);
    return () => clearTimeout(timer);
  }, [justLocked, permission]);
}
