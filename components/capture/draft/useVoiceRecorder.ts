import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useCallback } from "react";

import { meterLevel } from "./recordingMeter";

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

  /** Resolves to the recorded file's uri, or null when nothing was captured. */
  const stop = useCallback(async () => {
    await recorder.stop();
    return recorder.uri;
  }, [recorder]);

  return { durationMillis: state.durationMillis, level: meterLevel(state.metering), start, stop };
}
