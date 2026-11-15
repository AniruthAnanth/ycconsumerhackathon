import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useCallback } from "react";
import { Platform } from "react-native";

import { meterLevel } from "./recordingMeter";
import { recordingContentType } from "./recordingType";

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 100);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone access is off");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  /** Resolves to the recorded file's uri and upload content type, or null when nothing was captured. */
  const stop = useCallback(async () => {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return null;
    // Only a browser's recording says what it is; a phone's file is read as the preset's .m4a.
    const blobType = Platform.OS === "web" ? (await (await fetch(uri)).blob()).type : "";
    return { uri, contentType: recordingContentType(blobType) };
  }, [recorder]);

  return { durationMillis: state.durationMillis, level: meterLevel(state.metering), start, stop };
}
