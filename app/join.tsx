import { useRouter } from "expo-router";

import { CreateLeagueSection } from "@/components/join/CreateLeagueSection";
import { FormBody } from "@/components/join/FormBody";
import { InviteCodeSection } from "@/components/join/InviteCodeSection";
import { QuickMatchSection } from "@/components/join/QuickMatchSection";
import { useJoinLeague } from "@/components/join/useJoinLeague";
import { Header, Screen } from "@/components/ui";

/** Quick Match, an invite code, or a new league: three ways in, one screen. */
export default function JoinScreen() {
  const router = useRouter();
  const joining = useJoinLeague();
  return (
    <Screen>
      <Header title="Join a League" onBack={router.canGoBack() ? router.back : undefined} />
      <FormBody>
        <QuickMatchSection joining={joining} />
        <InviteCodeSection joining={joining} />
        <CreateLeagueSection joining={joining} />
      </FormBody>
    </Screen>
  );
}
