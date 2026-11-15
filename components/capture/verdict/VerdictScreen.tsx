import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnDeviceRead } from "@/components/onDeviceReferee/OnDeviceRead";
import { useOnDeviceRead } from "@/components/onDeviceReferee/useOnDeviceRead";
import { leaveScreen } from "@/lib/leaveScreen";
import { colors } from "@/theme";

import { parseCapture, parseProofTarget, proofCameraHref } from "../proofRoute";
import { ReviewingOverlay } from "./ReviewingOverlay";
import { StampBadge } from "./StampBadge";
import { useStampImpact } from "./useStampImpact";
import { useSubmitProof } from "./useSubmitProof";
import { VerdictMedia } from "./VerdictMedia";
import { VerdictPanel } from "./VerdictPanel";

export function VerdictScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const target = useMemo(() => parseProofTarget(params), [params]);
  const capture = useMemo(() => parseCapture(params), [params]);
  // The phone's own instant read of a photo. Absent in Expo Go, where it changes nothing.
  const onDevice = useOnDeviceRead(capture.mediaType === "photo" ? capture.uri : undefined, target);
  const { phase, retry } = useSubmitProof(target, capture, onDevice.beforeVerify);
  const impact = useStampImpact(phase.name === "verdict" ? phase.verdict.pass : undefined);

  const close = () => leaveScreen("/(tabs)");
  // Canvas has no camera to return to, so a failed check asks the backend again.
  const retryProof = capture.mediaType === "canvas" ? retry : () => router.replace(proofCameraHref(target));

  return (
    <View style={styles.screen}>
      {/* Only the proof and its stamp take the impact; the panel and the screen edges stay still. */}
      <View style={styles.media}>
        <Animated.View style={[styles.shake, impact.style]}>
          <VerdictMedia capture={capture} />
        </Animated.View>
        {/* The proof runs under the clock and battery. A dark band with light glyphs keeps them readable on any photo. */}
        <View pointerEvents="none" style={[styles.statusBand, { height: insets.top }]} />
        {phase.name === "reviewing" && <ReviewingOverlay title={target.title} />}
        {phase.name === "verdict" && !phase.verdict.needsVote && <StampBadge pass={phase.verdict.pass} onLand={impact.land} />}
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
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  media: { flex: 1.1, overflow: "hidden", backgroundColor: colors.text },
  shake: { flex: 1 },
  statusBand: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "rgba(0, 0, 0, 0.45)" },
});
