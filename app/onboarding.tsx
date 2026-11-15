import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** Name and phone. Built in the next shell pull request. */
export default function OnboardingScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Lineup" onBack={router.back} />
    </Screen>
  );
}
