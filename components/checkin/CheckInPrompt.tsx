import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { proofCameraHref } from "@/components/capture/proofRoute";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDevFlags } from "@/lib/devFlags";

import { CheckInPromptRow } from "./CheckInPromptRow";
import { arrivalKey } from "./coords";
import { useForegroundCoords } from "./useForegroundCoords";

const MINUTE_MS = 60 * 1000;

const floorToMinute = (ms: number) => Math.floor(ms / MINUTE_MS) * MINUTE_MS;

/**
 * The client clock floored to the minute. Convex queries cannot read the wall
 * clock, so the client passes it in; flooring keeps the query argument stable
 * for a minute instead of refetching on every render.
 */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => floorToMinute(Date.now()));
  useEffect(() => {
    // Aligned to the minute boundary so the label's countdown ticks over on time.
    const timer = setTimeout(() => setNow(floorToMinute(Date.now())), now + MINUTE_MS - Date.now());
    return () => clearTimeout(timer);
  }, [now]);
  return now;
}

/**
 * The pin of the player's first open task that has one, so the development
 * override's "place" spot can put the player exactly on it. Subscribes only
 * while the override is on; real devices never need it.
 */
function useOverridePlace(leagueId: Id<"leagues"> | null) {
  const { locationOverride } = useDevFlags();
  const roster = useQuery(api.lineup.roster, locationOverride && leagueId ? { leagueId } : "skip");
  return roster?.rows.find((row) => row.status === "open" && row.place)?.place;
}

/** The single line at the top of the Roster tab that asks the player to check in. Renders nothing when there is nothing to ask. */
export function CheckInPrompt({ leagueId }: { leagueId: Id<"leagues"> | null }) {
  const router = useRouter();
  const now = useMinuteClock();
  const overridePlace = useOverridePlace(leagueId);
  const coords = useForegroundCoords(overridePlace);
  const recordArrival = useMutation(api.checkins.recordArrival);
  const result = useQuery(api.checkins.prompt, leagueId ? { leagueId, now, ...(coords ?? {}) } : "skip");

  // useQuery is undefined while a new `now` or new coordinates load. Without
  // the last answer the row would blink out every minute. It is only reused for
  // the same league, so switching league never shows the old league's rival.
  const last = useRef<{ leagueId: Id<"leagues">; prompt: typeof result } | null>(null);
  if (leagueId && result !== undefined) last.current = { leagueId, prompt: result };
  const prompt = result !== undefined ? result : last.current?.leagueId === leagueId ? last.current?.prompt : undefined;

  // The server treats an arrival as an event, so it is reported once per
  // position fix rather than on every render or minute tick.
  const recorded = useRef<string | null>(null);
  const arrivedTaskId = prompt?.kind === "nearby" ? prompt.taskId : null;
  const lat = coords?.lat;
  const lng = coords?.lng;
  useEffect(() => {
    if (!arrivedTaskId || lat === undefined || lng === undefined) return;
    const key = arrivalKey(arrivedTaskId, lat, lng);
    if (recorded.current === key) return;
    recorded.current = key;
    // Fire and forget: a failed report must never break the row.
    recordArrival({ taskId: arrivedTaskId, lat, lng }).catch(() => {});
  }, [arrivedTaskId, lat, lng, recordArrival]);

  if (!prompt) return null;
  return (
    <CheckInPromptRow
      kind={prompt.kind}
      label={prompt.label}
      line={prompt.line}
      // Straight to the camera, the same way Roster's Submit Proof opens it.
      onCheckIn={() => router.push(proofCameraHref({ taskId: prompt.taskId, ...prompt.task }))}
    />
  );
}
