import { Stack } from "expo-router";

import { VerdictScreen } from "@/components/capture/verdict/VerdictScreen";

export default function VerdictRoute() {
  return (
    <>
      {/* The proof photo runs under the status bar; the native screen owns its style, as on the camera. */}
      <Stack.Screen options={{ statusBarStyle: "light" }} />
      <VerdictScreen />
    </>
  );
}
