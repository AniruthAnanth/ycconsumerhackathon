import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDevFlags } from "@/lib/devFlags";
import { colors, font, fontFamily, layout, spacing } from "@/theme";

import { formatElapsed } from "../proofKinds";
import type { ProofTarget } from "../proofRoute";
import { CameraOverlay } from "./CameraOverlay";
import { CameraPermissionPrompt } from "./CameraPermissionPrompt";
import { cameraScreen } from "./cameraScreen";
import { CameraUnavailable } from "./CameraUnavailable";
import { requestLocationFor } from "./deviceLocation";
import { GhostOverlay } from "./GhostOverlay";
import { SampleTray } from "./SampleTray";
import { ScreenshotPicker } from "./ScreenshotPicker";
import { modesFor, ShutterBar } from "./ShutterBar";
import { useProofCapture, type CaptureMode } from "./useProofCapture";

export function ProofCamera({ target }: { target: ProofTarget }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sampleMedia } = useDevFlags();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const modes = modesFor(target.proofType === "timelapse");
  const [mode, setMode] = useState<CaptureMode>(modes[0]);
  const capture = useProofCapture(target);

  useEffect(() => {
    requestLocationFor(target.proofType);
  }, [target.proofType]);

  if (target.proofType === "screenshot") {
    return (
      <View style={styles.screen}>
        <CameraOverlay target={target} onClose={() => router.back()} />
        <ScreenshotPicker busy={capture.busy} onPicked={(uri) => void capture.submitPicked(uri)} bottomInset={insets.bottom} />
      </View>
    );
  }

  const screen = cameraScreen({ sampleMedia, permission, cameraFailed: capture.cameraFailed });
  const start = { photo: capture.takePhoto, video: capture.startRecording, timelapse: capture.startTimelapse, interval: capture.startInterval }[mode];
  const shutter = capture.recording ? capture.stopRecording : start;
  const timelapse = target.proofType === "timelapse";
  const counter = timelapse
    ? capture.elapsedMs === null
      ? null
      : `${formatElapsed(capture.elapsedMs)} / ${capture.targetMinutes}:00`
    : capture.secondsRemaining === null
      ? null
      : `0:${String(capture.secondsRemaining).padStart(2, "0")}`;
  const reachedTarget = capture.elapsedMs !== null && capture.elapsedMs >= capture.targetMinutes * 60_000;

  return (
    <View style={styles.screen}>
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
      {target.proofType === "before_after" ? <GhostOverlay beforeUri={capture.before?.uri ?? null} /> : null}
      {permission && screen.askPermission ? (
        <CameraPermissionPrompt canAskAgain={permission.canAskAgain} onRequest={requestPermission} />
      ) : null}
      {screen.unavailable ? <CameraUnavailable onRetry={capture.retryCamera} /> : null}
      <CameraOverlay target={target} onClose={() => router.back()} />
      <View style={[styles.bottom, { paddingBottom: screen.samples ? 0 : insets.bottom }]} pointerEvents="box-none">
        {timelapse && capture.recording ? (
          <Text style={styles.hint} testID="camera-timelapse-status">
            {reachedTarget ? "Target reached. Stop when you're done." : `Keep going: ${capture.targetMinutes} min target`}
            {mode === "interval" ? ` · ${capture.frameCount} photos` : ""}
          </Text>
        ) : null}
        {capture.before && !capture.busy ? (
          <Pressable onPress={capture.retakeBefore} style={styles.retake} accessibilityRole="button" testID="camera-retake-before">
            <Text style={[styles.hint, styles.retakeLabel]}>Retake before</Text>
          </Pressable>
        ) : null}
        {screen.live ? (
          <ShutterBar
            modes={modes}
            mode={mode}
            recording={capture.recording}
            counter={counter}
            busy={capture.busy}
            onModeChange={setMode}
            onShutter={() => void shutter()}
            onFlip={() => setFacing(facing === "back" ? "front" : "back")}
          />
        ) : null}
        {screen.samplesOnly ? <Text style={styles.hint}>Tap a photo to submit</Text> : null}
        {screen.samples ? <SampleTray disabled={capture.busy} onPick={capture.submitSample} bottomInset={insets.bottom} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.text },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  retake: { alignSelf: "center", minHeight: layout.rowMin, justifyContent: "center", paddingHorizontal: spacing.lg },
  retakeLabel: { paddingBottom: 0, fontFamily: fontFamily.semiBold },
  hint: { color: colors.onAccent, fontFamily: fontFamily.regular, fontSize: font.body, textAlign: "center", opacity: 0.8, paddingBottom: spacing.md },
});
