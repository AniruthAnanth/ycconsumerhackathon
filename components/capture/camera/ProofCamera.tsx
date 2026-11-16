import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSwipeDownToClose } from "@/components/motion/useSwipeDownToClose";
import { confirmAction } from "@/components/social/notify";
import { useDevFlags } from "@/lib/devFlags";
import { leaveScreen } from "@/lib/leaveScreen";
import { colors, font, fontFamily, layout, spacing } from "@/theme";

import type { ProofTarget } from "../proofRoute";
import { CameraOverlay } from "./CameraOverlay";
import { CameraPermissionPrompt } from "./CameraPermissionPrompt";
import { cameraScreen } from "./cameraScreen";
import { CameraUnavailable } from "./CameraUnavailable";
import { requestLocationFor } from "./deviceLocation";
import { RecordingPanel } from "./RecordingPanel";
import { SampleTray } from "./SampleTray";
import { modesFor, ShutterBar } from "./ShutterBar";
import { TimelapseReview } from "./TimelapseReview";
import { useDimWhileRecording } from "./useDimWhileRecording";
import { useProofCapture, type CaptureMode } from "./useProofCapture";

export function ProofCamera({ target }: { target: ProofTarget }) {
  const insets = useSafeAreaInsets();
  const { sampleMedia } = useDevFlags();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  // Every proof is a timelapse (owner's call, Nov 16). The photo, before/after and screenshot
  // capture stay in the code base but are not offered.
  const modes = modesFor(true);
  const [mode, setMode] = useState<CaptureMode>(modes[0]);
  const capture = useProofCapture(target);
  // A running recording or a kept before shot is lost on the way out, so leaving then asks first.
  const holdsWork = capture.recording || capture.review !== null;
  const dim = useDimWhileRecording(capture.recording);
  const close = () => {
    if (!holdsWork) return leaveScreen("/(tabs)");
    confirmAction({
      title: capture.recording ? "Stop and discard?" : "Discard this timelapse?",
      message: "Nothing is sent. You can prove this task later.",
      confirmLabel: "Discard",
      onConfirm: () => leaveScreen("/(tabs)"),
    });
  };
  const swipe = useSwipeDownToClose(close, holdsWork);

  useEffect(() => {
    requestLocationFor(target.proofType);
  }, [target.proofType]);

  const screen = cameraScreen({ sampleMedia, permission, cameraFailed: capture.cameraFailed });
  const start = {
    photo: capture.takePhoto,
    video: capture.startRecording,
    timelapse: capture.startTimelapse,
    interval: capture.startInterval,
  }[mode];
  const stop = () => {
    dim.wake();
    void capture.stopRecording();
  };

  if (capture.review) {
    return (
      <TimelapseReview
        review={capture.review}
        busy={capture.busy}
        bottomInset={insets.bottom}
        onSubmit={() => void capture.submitReview()}
        onRetake={capture.retake}
      />
    );
  }

  return (
    <GestureDetector gesture={swipe.gesture}>
      <Animated.View style={[styles.screen, swipe.style]} onTouchStart={dim.wake}>
        {screen.live ? (
          <CameraView
            ref={capture.camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode={mode === "video" || mode === "timelapse" ? "video" : "picture"}
            mute
            onMountError={capture.markCameraFailed}
          />
        ) : null}
        {permission && screen.askPermission ? (
          <CameraPermissionPrompt canAskAgain={permission.canAskAgain} onRequest={requestPermission} />
        ) : null}
        {screen.unavailable ? <CameraUnavailable onRetry={capture.retryCamera} /> : null}
        {/* Dimmed, the screen keeps only the recording panel on black, which is what saves the battery on an OLED phone. */}
        {dim.dimmed ? <View style={styles.dark} pointerEvents="none" testID="timelapse-dimmed" /> : null}
        {dim.dimmed ? null : <CameraOverlay target={target} onClose={close} />}
        <View style={[styles.bottom, { paddingBottom: screen.samples ? 0 : insets.bottom }]} pointerEvents="box-none">
          {capture.recording && capture.elapsedMs !== null ? (
            <RecordingPanel
              elapsedMs={capture.elapsedMs}
              targetMinutes={capture.targetMinutes}
              frameCount={mode === "interval" || !screen.live ? capture.frameCount : null}
              onStop={stop}
            />
          ) : screen.live ? (
            <ShutterBar
              modes={modes}
              mode={mode}
              recording={false}
              counter={null}
              busy={capture.busy}
              onModeChange={setMode}
              onShutter={() => void start()}
              onFlip={() => setFacing(facing === "back" ? "front" : "back")}
            />
          ) : null}
          {screen.samplesOnly && !capture.recording ? <Text style={styles.hint}>Tap a photo to start a sample timelapse</Text> : null}
          {screen.samples && !capture.recording ? (
            <SampleTray disabled={capture.busy} onPick={capture.startSampleTimelapse} bottomInset={insets.bottom} />
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.text },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  dark: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000" },
  retake: { alignSelf: "center", minHeight: layout.rowMin, justifyContent: "center", paddingHorizontal: spacing.lg },
  retakeLabel: { paddingBottom: 0, fontFamily: fontFamily.semiBold },
  hint: {
    color: colors.onAccent,
    fontFamily: fontFamily.regular,
    fontSize: font.body,
    textAlign: "center",
    opacity: 0.8,
    paddingBottom: spacing.md,
  },
});
