import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** Placeholder so the route exists; the capture thread (YCCO-11) replaces this file. */
export default function DemoControlsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Demo Controls" onBack={router.back} />
    </Screen>
  );
}
