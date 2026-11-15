import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";

import { Header, Screen } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useCurrentLeague } from "@/lib/currentLeague";
import { useNow } from "@/lib/useNow";

import { BoardPicker } from "./BoardPicker";
import { parseBoardKey } from "./boards";
import { hourStart } from "./format";
import { LeaderboardTable } from "./LeaderboardTable";
import { RivalLine } from "./RivalLine";

export function LeaderboardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ board?: string }>();
  const { leagueId } = useCurrentLeague();
  const [board, setBoard] = useState(parseBoardKey(params.board) ?? "week");
  // Only the money board is projected from the clock, so only it takes the hour: the other boards keep their cached result across hours.
  const at = hourStart(useNow(60_000));
  const result = useQuery(api.leaderboards.board, leagueId ? { leagueId, board, ...(board === "money" ? { at } : {}) } : "skip");
  const sync = useMutation(api.leaderboards.sync);

  // The boards are rebuilt from write hooks; syncing on open covers a hook that was missed.
  useEffect(() => {
    if (leagueId) sync({ leagueId }).catch(() => {});
  }, [leagueId, sync]);

  return (
    <Screen>
      <Header
        title={result?.title ?? "Leaderboards"}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/league"))}
      />
      <BoardPicker active={board} onChange={setBoard} />
      <ScrollView>
        <RivalLine label={result?.rival?.label} />
        <LeaderboardTable valueHeader={result?.valueHeader ?? ""} rows={result?.rows} />
      </ScrollView>
    </Screen>
  );
}
