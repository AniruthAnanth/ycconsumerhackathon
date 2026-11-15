/**
 * Hidden controls for running the demo from the phone, opened by a long press on the week
 * label. Each one calls the same backend function a real week would reach on its own schedule,
 * so what the audience sees is the product, only on demand.
 */
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";

import { capture } from "@/components/capture/backend";
import { DeviceError } from "@/components/capture/errorMessage";
import { Header, Screen, SectionLabel } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { setDevFlag, useDevFlags } from "@/lib/devFlags";
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
  const triggerMystery = useMutation(capture.drops.triggerMystery);
  const settleWeek = useAction(capture.whop.settleWeek);
  const resetSeed = useMutation(capture.seed.reset);
  const actAs = useMutation(capture.seed.actAs);
  const pinCheckIn = useMutation(capture.demo.pinCheckIn);
  const flags = useDevFlags();
  const actingAsId = me?.actingAs?._id;

  return (
    <Screen scroll>
      {/* Opened by a link rather than the week label, there is no screen to go back to. */}
      <Header title="Demo controls" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />

      <SectionLabel left="LEAGUE" />
      <ActionRow
        label="Trigger Quick-Time Drop"
        disabled={!leagueId}
        run={async () => {
          if (leagueId) await triggerQuickTime({ leagueId });
        }}
      />
      <ActionRow
        label="Trigger Mystery Task"
        disabled={!leagueId}
        run={async () => {
          if (leagueId) await triggerMystery({ leagueId });
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
    </Screen>
  );
}
