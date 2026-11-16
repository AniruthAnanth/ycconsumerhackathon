import { useMutation } from "convex/react";

import { confirmAction, notify } from "@/components/social/notify";
import { api } from "@/convex/_generated/api";
import type { MyLeague } from "@/lib/backend";
import { errorMessage } from "@/lib/errorMessage";
import { stakeLine } from "@/lib/leagueText";

import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/**
 * The leagues the header's switcher lists, each with a way out. Leaving the league on screen
 * moves the app to the next one (lib/currentLeague); leaving the last sends the player to Join.
 */
export function LeaguesSection({ leagues }: { leagues: MyLeague[] }) {
  const leave = useMutation(api.leagues.leave);

  function confirmLeave(league: MyLeague) {
    confirmAction({
      title: `Leave ${league.name}?`,
      message: "You'll drop off its standings, boards and texts. Your lineup and proofs stay yours.",
      confirmLabel: "Leave",
      onConfirm: () => {
        leave({ leagueId: league._id }).catch((failure) => notify("Couldn't leave", errorMessage(failure)));
      },
    });
  }

  return (
    <SettingsGroup title="Leagues">
      {leagues.flatMap((league) => [
        <SettingsRow key={league._id} title={league.name} subtitle={stakeLine(league)} />,
        <SettingsRow
          key={`${league._id}-leave`}
          title="Leave league"
          destructive
          onPress={() => confirmLeave(league)}
          accessibilityLabel={`Leave ${league.name}`}
        />,
      ])}
    </SettingsGroup>
  );
}
