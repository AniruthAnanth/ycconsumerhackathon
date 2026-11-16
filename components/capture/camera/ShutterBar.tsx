import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import type { CaptureProofType } from "../proofKinds";
import type { CaptureMode } from "./useProofCapture";

const RECORD_RED = colors.danger;

// expo-camera cannot record on web: recordAsync only warns and returns an empty file.
const RECORDS = Platform.OS !== "web";

/**
 * The modes a task offers, first one selected: its own type first. A photo task may also be shown
 * with a 5-second video instead; interval photos stand in for the timelapse where recording is impossible.
 */
export function modesFor(proofType: CaptureProofType): CaptureMode[] {
  if (proofType === "timelapse") return [RECORDS ? "timelapse" : "interval"];
  if (proofType === "survey_video") return ["survey"];
  if (proofType === "photo") return ["photo", "survey"];
  return ["photo"];
}

const MODE_LABEL: Record<CaptureMode, string> = {
  photo: "PHOTO",
  video: "VIDEO",
  timelapse: "TIMELAPSE",
  interval: "TIMELAPSE",
  survey: "QUICK VIDEO (5 S)",
};

type Props = {
  modes: CaptureMode[];
  mode: CaptureMode;
  recording: boolean;
  /** Shown above the shutter while it runs: a countdown, or a timelapse's elapsed time. */
  counter: string | null;
  busy: boolean;
  onModeChange: (mode: CaptureMode) => void;
  onShutter: () => void;
  onFlip: () => void;
};

/** Photo / Video switch, the shutter with its countdown, and the camera flip. */
export function ShutterBar({ modes, mode, recording, counter, busy, onModeChange, onShutter, onFlip }: Props) {
  const idle = !recording && !busy;
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Text style={styles.counter}>{recording && counter ? counter : " "}</Text>
      <View style={styles.row}>
        <View style={styles.side}>
          {modes.map((option) => (
            <Pressable key={option} disabled={!idle} onPress={() => onModeChange(option)} hitSlop={8} testID={`camera-mode-${option}`}>
              <Text style={[styles.mode, mode === option && styles.modeActive]}>{MODE_LABEL[option]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onShutter}
          disabled={busy && !recording}
          accessibilityLabel={recording ? "Stop recording" : "Take proof"}
          style={styles.shutterRing}
          testID="camera-shutter"
        >
          <View
            style={[
              styles.shutter,
              mode !== "photo" && styles.shutterVideo,
              recording && styles.shutterRecording,
            ]}
          />
        </Pressable>
        <View style={styles.side}>
          <Pressable disabled={!idle} onPress={onFlip} hitSlop={8} accessibilityLabel="Flip camera">
            <Text style={styles.mode}>FLIP</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  counter: { color: colors.onAccent, fontSize: 20, fontFamily: fontFamily.bold, ...tabular },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", paddingHorizontal: SCREEN_MARGIN },
  side: { width: 80, gap: spacing.md, alignItems: "center" },
  mode: { color: colors.onAccent, fontSize: 13, fontFamily: fontFamily.bold, letterSpacing: 1, opacity: 0.6 },
  modeActive: { opacity: 1 },
  shutterRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: colors.background, alignItems: "center", justifyContent: "center" },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background },
  shutterVideo: { backgroundColor: RECORD_RED },
  shutterRecording: { width: 34, height: 34, borderRadius: 6 },
});
