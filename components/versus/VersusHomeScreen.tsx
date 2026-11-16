import { useQuery } from "convex/react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { PayButton } from "@/components/money/PayButton";
import { ScreenState } from "@/components/social/ScreenState";
import { Header, Screen } from "@/components/ui";
import { VersusMatchup } from "./VersusMatchup";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** A versus's own home: the head-to-head matchup and its pot. */
export function VersusHomeScreen() {
  const router = useRouter();
  const leagueId = useLocalSearchParams<{ leagueId: string }>().leagueId as Id<"leagues">;
  const versus = useQuery(api.versus.get, { leagueId });
  // Null once "make it a league" has turned it into an ordinary league, which the tabs show.
  if (versus === null) return <Redirect href="/matchup" />;
  return (
    <Screen>
      <Header
        title={versus?.opponent ? `vs ${versus.opponent.name}` : "Versus"}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/matchup"))}
        rightAction={<PayButton leagueId={leagueId} />}
      />
      {versus ? <VersusMatchup versus={versus} /> : <ScreenState loading />}
    </Screen>
  );
}
