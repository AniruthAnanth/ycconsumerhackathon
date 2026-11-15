import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** Placeholder so the route exists; the capture thread (YCCO-11) replaces this file. */
export default function ProofScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Submit Proof" onBack={router.back} />
    </Screen>
  );
}
