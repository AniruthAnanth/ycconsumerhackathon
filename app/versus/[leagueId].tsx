import { useQuery } from "convex/react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { ScreenState } from "@/components/social/ScreenState";
import { Header, Screen } from "@/components/ui";
import { versusApi } from "@/components/versus/api";
import { VersusMatchup } from "@/components/versus/VersusMatchup";
import type { Id } from "@/convex/_generated/dataModel";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/** A versus's own home: the head-to-head matchup and its pot. */
export default function VersusHomeScreen() {
  const router = useRouter();
  const leagueId = useLocalSearchParams<{ leagueId: string }>().leagueId as Id<"leagues">;
  const versus = useQuery(versusApi.get, { leagueId });
  // Null once "make it a league" has turned it into an ordinary league, which the tabs show.
  if (versus === null) return <Redirect href="/matchup" />;
  return (
    <Screen>
      <Header
        title={versus?.opponent ? `vs ${versus.opponent.name}` : "Versus"}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/matchup"))}
      />
      {versus ? <VersusMatchup versus={versus} /> : <ScreenState loading />}
    </Screen>
  );
}
