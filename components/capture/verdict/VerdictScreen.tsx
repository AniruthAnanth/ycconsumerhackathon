import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { OnDeviceRead } from "@/components/onDeviceReferee/OnDeviceRead";
import { useOnDeviceRead } from "@/components/onDeviceReferee/useOnDeviceRead";

import { parseCapture, parseProofTarget, proofCameraHref } from "../proofRoute";
import { ReviewingOverlay } from "./ReviewingOverlay";
import { StampBadge } from "./StampBadge";
import { useStampImpact } from "./useStampImpact";
import { useSubmitProof } from "./useSubmitProof";
import { VerdictMedia } from "./VerdictMedia";
import { VerdictPanel } from "./VerdictPanel";

export function VerdictScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const target = useMemo(() => parseProofTarget(params), [params]);
  const capture = useMemo(() => parseCapture(params), [params]);
  // The phone's own instant read of a photo. Absent in Expo Go, where it changes nothing.
  const onDevice = useOnDeviceRead(capture.mediaType === "photo" ? capture.uri : undefined, target);
  const { phase, retry } = useSubmitProof(target, capture, onDevice.beforeVerify);
  const impact = useStampImpact(phase.name === "verdict" ? phase.verdict.pass : undefined);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  // Canvas has no camera to return to, so a failed check asks the backend again.
  const retryProof = capture.mediaType === "canvas" ? retry : () => router.replace(proofCameraHref(target));

  return (
    <Animated.View style={[styles.screen, impact]}>
      <View style={styles.media}>
        <VerdictMedia capture={capture} />
        {phase.name === "reviewing" && <ReviewingOverlay title={target.title} />}
        {phase.name === "verdict" && <StampBadge pass={phase.verdict.pass} />}
      </View>
      <VerdictPanel
        phase={phase}
        onDone={close}
        onRetry={phase.name === "error" ? retry : retryProof}
        onClose={close}
        whileReviewing={
          <OnDeviceRead
            read={onDevice.read}
            asking={onDevice.asking}
            onRetake={retryProof}
            onSendAnyway={onDevice.sendAnyway}
          />
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  media: { flex: 1.1, overflow: "hidden" },
});
