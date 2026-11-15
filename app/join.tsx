import { useLocalSearchParams, useRouter } from "expo-router";

import { CreateLeagueSection } from "@/components/join/CreateLeagueSection";
import { FormBody } from "@/components/join/FormBody";
import { InviteCodeSection } from "@/components/join/InviteCodeSection";
import { QuickMatchSection } from "@/components/join/QuickMatchSection";
import { StepContext } from "@/components/join/StepContext";
import { useJoinLeague } from "@/components/join/useJoinLeague";
import { Header, Screen } from "@/components/ui";
import { ChallengeSection } from "@/components/versus/ChallengeSection";
import { useCurrentLeague } from "@/lib/currentLeague";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/**
 * A 1v1 challenge, Quick Match, an invite code, or a new league: four ways in,
 * one screen. The free Quick Match is the primary action; the rest are secondary.
 */
export default function JoinScreen() {
  const router = useRouter();
  const joining = useJoinLeague();
  const { me } = useCurrentLeague();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  // Only on the way into a first league (or its replay) is this a step of something larger.
  const firstLeague = replay === "1" || me?.leagues.length === 0;
  return (
    <Screen>
      <Header title="Join a League" onBack={router.canGoBack() ? router.back : undefined} />
      {firstLeague ? <StepContext step={2} label="Join or start a league" /> : null}
      <FormBody>
        <ChallengeSection disabled={joining.busy} />
        <QuickMatchSection joining={joining} />
        <InviteCodeSection joining={joining} />
        <CreateLeagueSection disabled={joining.busy} />
      </FormBody>
    </Screen>
  );
}
