import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** Placeholder so the route exists; the social thread (YCCO-12) replaces this file. */
export default function GroupSessionScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Group Session" onBack={router.back} />
    </Screen>
  );
}
