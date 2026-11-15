import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDevFlags } from "@/lib/devFlags";
import { colors } from "@/theme";

import type { ProofTarget } from "../proofRoute";
import { CameraOverlay } from "./CameraOverlay";
import { CameraPermissionPrompt } from "./CameraPermissionPrompt";
import { cameraScreen } from "./cameraScreen";
import { CameraUnavailable } from "./CameraUnavailable";
import { requestLocationFor } from "./deviceLocation";
import { SampleTray } from "./SampleTray";
import { ShutterBar } from "./ShutterBar";
import { useProofCapture, type CaptureMode } from "./useProofCapture";

export function ProofCamera({ target }: { target: ProofTarget }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sampleMedia } = useDevFlags();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [mode, setMode] = useState<CaptureMode>("photo");
  const capture = useProofCapture(target);

  useEffect(() => {
    requestLocationFor(target.proofType);
  }, [target.proofType]);

  const screen = cameraScreen({ sampleMedia, permission, cameraFailed: capture.cameraFailed });
  const shutter = mode === "photo" ? capture.takePhoto : capture.recording ? capture.stopRecording : capture.startRecording;

  return (
    <View style={styles.screen}>
      {screen.live ? (
        <CameraView ref={capture.camera} style={StyleSheet.absoluteFill} facing={facing} mode={mode === "photo" ? "picture" : "video"} mute onMountError={capture.markCameraFailed} />
      ) : null}
      {permission && screen.askPermission ? (
        <CameraPermissionPrompt canAskAgain={permission.canAskAgain} onRequest={requestPermission} />
      ) : null}
      {screen.unavailable ? <CameraUnavailable onRetry={capture.retryCamera} /> : null}
      <CameraOverlay target={target} onClose={() => router.back()} />
      <View style={[styles.bottom, { paddingBottom: screen.samples ? 0 : insets.bottom }]} pointerEvents="box-none">
        {screen.live ? (
          <ShutterBar
            mode={mode}
            recording={capture.recording}
            secondsRemaining={capture.secondsRemaining}
            busy={capture.busy}
            onModeChange={setMode}
            onShutter={shutter}
            onFlip={() => setFacing(facing === "back" ? "front" : "back")}
          />
        ) : null}
        {screen.samples ? <SampleTray disabled={capture.busy} onPick={capture.submitSample} bottomInset={insets.bottom} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.text },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
});
