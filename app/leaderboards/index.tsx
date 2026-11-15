import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";

import { BoardPicker, LeaderboardTable, parseBoardKey, RivalLine } from "@/components/leaderboards";
import { Header, Screen } from "@/components/ui";
import { leaderboards } from "@/components/leaderboards/backend";
import { useCurrentLeague } from "@/lib/currentLeague";

export default function LeaderboardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ board?: string }>();
  const { leagueId } = useCurrentLeague();
  const [board, setBoard] = useState(parseBoardKey(params.board) ?? "week");
  const result = useQuery(leaderboards.board, leagueId ? { leagueId, board } : "skip");
  const sync = useMutation(leaderboards.sync);

  // The boards are rebuilt from write hooks; syncing on open covers a hook that was missed.
  useEffect(() => {
    if (leagueId) sync({ leagueId }).catch(() => {});
  }, [leagueId, sync]);

  return (
    <Screen>
      <Header title="Leaderboards" onBack={router.back} />
      <BoardPicker active={board} onChange={setBoard} />
      <ScrollView>
        <RivalLine label={result?.rival?.label} />
        <LeaderboardTable valueHeader={result?.valueHeader ?? ""} rows={result?.rows} />
      </ScrollView>
    </Screen>
  );
}
