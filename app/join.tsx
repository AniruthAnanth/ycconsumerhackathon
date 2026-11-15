import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** Create a league, enter an invite code, or Quick Match. Built in the next shell pull request. */
export default function JoinScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Join a League" onBack={router.back} />
    </Screen>
  );
}
