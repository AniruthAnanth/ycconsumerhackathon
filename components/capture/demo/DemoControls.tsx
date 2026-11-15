/**
 * Hidden controls for running the demo from the phone, opened by a long press on the week
 * label. Each one calls the same backend function a real week would reach on its own schedule,
 * so what the audience sees is the product, only on demand.
 */
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";

import { capture } from "@/components/capture/backend";
import { Header, Screen, SectionLabel } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { setDevFlag, useDevFlags } from "@/lib/devFlags";

import { ActionRow } from "./ActionRow";
import { FlagRow, OverrideSpotRow } from "./FlagRows";

export function DemoControls() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const me = useQuery(backend.users.me);
  const players = useQuery(capture.seed.players);
  const triggerQuickTime = useMutation(capture.drops.triggerQuickTime);
  const settleWeek = useAction(capture.whop.settleWeek);
  const resetSeed = useMutation(capture.seed.reset);
  const actAs = useMutation(capture.seed.actAs);
  const flags = useDevFlags();
  const actingAsId = me?.actingAs?._id;

  return (
    <Screen scroll>
      <Header title="Demo controls" onBack={router.back} />

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
