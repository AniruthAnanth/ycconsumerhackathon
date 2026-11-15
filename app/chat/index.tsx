import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** Placeholder so the route exists; the social thread (YCCO-12) replaces this file. */
export default function ChatScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="League Chat" onBack={router.back} />
    </Screen>
  );
}
