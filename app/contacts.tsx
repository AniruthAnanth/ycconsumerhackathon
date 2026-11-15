import { useRouter } from "expo-router";

import { Header, Screen } from "@/components/ui";

/** The contacts step after joining a league. Built in the next shell pull request. */
export default function ContactsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Add Friends" onBack={router.back} />
    </Screen>
  );
}
