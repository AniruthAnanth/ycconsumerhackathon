import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { errorMessage } from "@/components/join/errorMessage";
import { ScreenState } from "@/components/social/ScreenState";
import { Header, Screen } from "@/components/ui";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/** Where a challenge link lands (lineup://versus/join?code=ABC123): accept it and open the versus. */
export default function JoinVersusScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { setLeagueId } = useCurrentLeague();
  const joinByCode = useMutation(backend.leagues.joinByCode);
  const [failure, setFailure] = useState<string | null>(null);
  // Effects can run twice; a second join would fail on an already-full versus and show a false error.
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    joinByCode({ inviteCode: code.trim() })
      .then(({ leagueId }) => {
        setLeagueId(leagueId);
        router.replace({ pathname: "/versus/[leagueId]", params: { leagueId } });
      })
      .catch((error) => setFailure(errorMessage(error)));
  });

  return (
    <Screen>
      <Header title="Challenge" onBack={() => router.replace("/join")} />
      {code && !failure ? <ScreenState loading /> : <ScreenState message={failure ?? "This link has no invite code."} />}
    </Screen>
  );
}
