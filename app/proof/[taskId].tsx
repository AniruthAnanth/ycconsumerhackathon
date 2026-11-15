import { useLocalSearchParams } from "expo-router";

import { ProofCamera } from "@/components/capture/camera/ProofCamera";
import { parseProofTarget } from "@/components/capture/proofRoute";

export default function ProofCameraRoute() {
  return <ProofCamera target={parseProofTarget(useLocalSearchParams())} />;
}
