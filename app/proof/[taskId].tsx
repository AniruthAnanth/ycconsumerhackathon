import { Stack, useLocalSearchParams } from "expo-router";

import { ProofCamera } from "@/components/capture/camera/ProofCamera";
import { parseProofTarget } from "@/components/capture/proofRoute";
import { CoachTour } from "@/components/coach";

export default function ProofCameraRoute() {
  return (
    <>
      {/* The camera is dark edge to edge. This screen is a native full-screen modal, which owns its status bar, so expo-status-bar inside it is ignored. */}
      <Stack.Screen options={{ statusBarStyle: "light" }} />
      {/* The first time a player opens the camera: what to capture, and that the AI checks it. */}
      <CoachTour tour="proof">
        <ProofCamera target={parseProofTarget(useLocalSearchParams())} />
      </CoachTour>
    </>
  );
}
