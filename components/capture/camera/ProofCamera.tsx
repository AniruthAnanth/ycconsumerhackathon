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
import { colors, font, fontFamily, layout, spacing, tabular } from "@/theme";

import type { ProofTarget } from "../proofRoute";
import { CameraOverlay } from "./CameraOverlay";
import { CameraPermissionPrompt } from "./CameraPermissionPrompt";
import { cameraScreen } from "./cameraScreen";
import { CameraUnavailable } from "./CameraUnavailable";
import { requestLocationFor } from "./deviceLocation";
import { GhostOverlay, GhostStep } from "./GhostOverlay";
import { RecordingPanel } from "./RecordingPanel";
import { SampleTray } from "./SampleTray";
import { ScreenshotPicker } from "./ScreenshotPicker";
import { modesFor, ShutterBar } from "./ShutterBar";
import { TimelapseReview } from "./TimelapseReview";
import { useDimWhileRecording } from "./useDimWhileRecording";
import { useProofCapture, type CaptureMode } from "./useProofCapture";

export function ProofCamera({ target }: { target: ProofTarget }) {
  const insets = useSafeAreaInsets();
  const { sampleMedia } = useDevFlags();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const modes = modesFor(target.proofType);
  const [mode, setMode] = useState<CaptureMode>(modes[0]);
  const capture = useProofCapture(target);
  // A running recording, a kept before shot or a proof under review is lost on the way out, so leaving then asks first.
  const holdsWork = capture.recording || capture.review !== null || capture.before !== null;
  const dim = useDimWhileRecording(capture.elapsedMs !== null);
  const close = () => {
    if (!holdsWork) return leaveScreen("/(tabs)");
    confirmAction({
      title: capture.recording ? "Stop and discard?" : capture.before ? "Discard the before shot?" : "Discard this proof?",
      message: "Nothing is sent. You can prove this task later.",
      confirmLabel: "Discard",
      onConfirm: () => leaveScreen("/(tabs)"),
    });
  };
  const swipe = useSwipeDownToClose(close, holdsWork);

  useEffect(() => {
    requestLocationFor(target.proofType);
  }, [target.proofType]);

  if (target.proofType === "screenshot") {
    return (
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[styles.screen, swipe.style]}>
          <CameraOverlay target={target} onClose={close} />
          <ScreenshotPicker busy={capture.busy} onPicked={(uri) => void capture.submitPicked(uri)} bottomInset={insets.bottom} />
        </Animated.View>
      </GestureDetector>
    );
  }

  const screen = cameraScreen({ sampleMedia, permission, cameraFailed: capture.cameraFailed });
  const start = {
    photo: capture.takePhoto,
    video: capture.startRecording,
    timelapse: capture.startTimelapse,
    interval: capture.startInterval,
    survey: capture.startSurvey,
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
            mode={mode === "video" || mode === "timelapse" || mode === "survey" ? "video" : "picture"}
            mute
            onMountError={capture.markCameraFailed}
          />
        ) : null}
        {target.proofType === "before_after" ? <GhostOverlay beforeUri={capture.before?.uri ?? null} /> : null}
        {permission && screen.askPermission ? (
          <CameraPermissionPrompt canAskAgain={permission.canAskAgain} onRequest={requestPermission} />
        ) : null}
        {screen.unavailable ? <CameraUnavailable onRetry={capture.retryCamera} /> : null}
        {/* Dimmed, the screen keeps only the recording panel on black, which is what saves the battery on an OLED phone. */}
        {dim.dimmed ? <View style={styles.dark} pointerEvents="none" testID="timelapse-dimmed" /> : null}
        {dim.dimmed ? null : <CameraOverlay target={target} onClose={close} />}
        <View style={[styles.bottom, { paddingBottom: screen.samples ? 0 : insets.bottom }]} pointerEvents="box-none">
          {target.proofType === "before_after" && !capture.recording ? <GhostStep beforeUri={capture.before?.uri ?? null} /> : null}
          {capture.before && !capture.busy ? (
            <Pressable onPress={capture.retakeBefore} style={styles.retake} accessibilityRole="button" testID="camera-retake-before">
              <Text style={[styles.hint, styles.retakeLabel]}>Retake before</Text>
            </Pressable>
          ) : null}
          {capture.recording && capture.secondsRemaining !== null ? (
            <Text style={styles.countdown} testID="survey-countdown">
              {capture.secondsRemaining}
            </Text>
          ) : null}
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
          {screen.samplesOnly && !capture.recording ? <Text style={styles.hint}>{SAMPLE_HINT[modes[0]]}</Text> : null}
          {screen.samples && !capture.recording ? (
            <SampleTray
              disabled={capture.busy}
              onPick={(sample) => {
                if (sample.mediaType === "video") return void capture.sampleSurvey(sample);
                if (target.proofType === "timelapse") return void capture.startSampleTimelapse(sample);
                void capture.submitSample(sample);
              }}
              bottomInset={insets.bottom}
            />
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const SAMPLE_HINT: Record<CaptureMode, string> = {
  photo: "Tap a sample to submit it",
  video: "Tap a sample to submit it",
  timelapse: "Tap a photo for a sample timelapse",
  interval: "Tap a photo for a sample timelapse",
  survey: "Tap the video for a sample 5-second video",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.text },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  countdown: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: 48, textAlign: "center", ...tabular },
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
