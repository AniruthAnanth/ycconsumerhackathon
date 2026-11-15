/**
 * Hidden controls for running the demo from the phone, opened by a long press on the week
 * label. Each one calls the same backend function a real week would reach on its own schedule,
 * so what the audience sees is the product, only on demand.
 */
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { ScrollView } from "react-native";

import { capture } from "@/components/capture/backend";
import { Header, Screen, SectionLabel } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { setDevFlag, useDevFlags } from "@/lib/devFlags";
import { DeviceError } from "@/lib/errorMessage";
import { previewDropNotification } from "@/lib/notifications/preview";

import { deviceGps, requestLocationFor } from "../camera/deviceLocation";
import { ActionRow } from "./ActionRow";
import { FlagRow, OverrideSpotRow } from "./FlagRows";
import { phoneCoords, type PhoneGps } from "./phoneCoords";

const PHONE_GPS: PhoneGps = {
  requestPermission: () => requestLocationFor("photo_location"),
  hasPermission: deviceGps.hasPermission,
  current: deviceGps.current,
  lastKnown: deviceGps.lastKnown,
};

export function DemoControls() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const me = useQuery(backend.users.me);
  const players = useQuery(capture.seed.players);
  const triggerQuickTime = useMutation(capture.drops.triggerQuickTime);
  const settleWeek = useAction(capture.whop.settleWeek);
  const resetSeed = useMutation(capture.seed.reset);
  const actAs = useMutation(capture.seed.actAs);
  const pinCheckIn = useMutation(capture.demo.pinCheckIn);
  const nudgeNow = useMutation(api.checkins.nudgeNow);
  const nudgeTurn = useRef(0);
  const flags = useDevFlags();
  const actingAsId = me?.actingAs?._id;

  return (
    <Screen>
      {/* Above the scroll view, not inside it, so Back stays in reach from the switches at the bottom. */}
      <Header
        title="Demo controls"
        onBack={() => {
          // Roster's week label is the only way in, so Back always lands on Roster, on a fresh set
          // of tabs. Going back one screen is not enough after Switch Player or Reset Seed: the
          // tabs underneath were built for the player before. Dismiss, then replace, is how the
          // contacts step leaves too (app/contacts.tsx).
          if (router.canDismiss()) router.dismissAll();
          router.replace("/");
        }}
      />
      <ScrollView keyboardShouldPersistTaps="handled">
        <SectionLabel left="LEAGUE" />
        <ActionRow
          label="Trigger Quick-Time Drop"
          disabled={!leagueId}
          run={async () => {
            if (leagueId) await triggerQuickTime({ leagueId });
          }}
        />
        <ActionRow
          label="End Week Now"
          disabled={!leagueId}
          run={async () => {
            if (leagueId) await settleWeek({ leagueId });
          }}
        />
        <ActionRow label="Reset Seed" run={() => resetSeed({})} />

        <SectionLabel left="CHECK-IN" />
        {/* The location check-in passes only within 150 m of its pin, so the pin moves to the stage. */}
        <ActionRow label="Pin check-in here" run={async () => pinCheckIn(await phoneCoords(PHONE_GPS))} />

        <SectionLabel left="NOTIFICATIONS" />
        {/* The Keiki nudge this player is due, without waiting for its hour. Each tap sends the next kind. */}
        <ActionRow
          label="Send nudge now"
          run={async () => {
            const nudge = await nudgeNow({ leagueId: leagueId ?? undefined, turn: nudgeTurn.current++ });
            if (nudge.text === null) throw new DeviceError("Nothing to nudge about: no task is open this week.");
            // Not opted in to texts and no phone to push: show the words here instead.
            if (!nudge.delivered) throw new DeviceError(`Turn on Play by text to receive it: ${nudge.text}`);
          }}
        />
        {/* Five seconds out, so there is time to lock the phone and show it arriving. */}
        <ActionRow
          label="Preview Drop Notification (5 s)"
          run={async () => {
            if (!(await previewDropNotification())) throw new DeviceError("Notifications are off for Lineup on this device.");
          }}
        />

        <SectionLabel left="SWITCH PLAYER" />
        <ActionRow label="Me" tag={actingAsId ? undefined : "PLAYING"} run={() => actAs({ userId: null })} />
        {players?.map((player) => (
          <ActionRow
            key={player._id}
            label={player.name}
            tag={player._id === actingAsId ? "PLAYING" : undefined}
            run={() => actAs({ userId: player._id })}
          />
        ))}

        <SectionLabel left="DEVELOPMENT" />
        <FlagRow label="Sample media" value={flags.sampleMedia} onChange={(on) => setDevFlag("sampleMedia", on)} />
        <FlagRow label="Sample voice note" value={flags.sampleVoice} onChange={(on) => setDevFlag("sampleVoice", on)} />
        <FlagRow
          label="Location override"
          value={flags.locationOverride}
          onChange={(on) => setDevFlag("locationOverride", on)}
        />
        {flags.locationOverride ? (
          <OverrideSpotRow value={flags.overrideSpot} onChange={(spot) => setDevFlag("overrideSpot", spot)} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
