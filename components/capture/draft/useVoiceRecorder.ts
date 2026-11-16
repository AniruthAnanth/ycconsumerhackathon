import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { meterLevel } from "./recordingMeter";
import { recordingContentType } from "./recordingType";

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** One finished stretch of recording, read into memory before the next stretch can reuse the file. */
export type Segment = { blob: Blob; contentType: string };

/**
 * Records in segments: cut() closes the current file and starts a new one straight away, so each
 * segment can be transcribed while the player keeps talking. A file still being written can't be
 * read (an .m4a is only playable once closed), which is why the recording is cut rather than read.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 100);
  // Time in segments already closed, so the timer and the one-minute limit count the whole take.
  const [closedMillis, setClosedMillis] = useState(0);

  // Leaving the screen mid-recording releases the recorder. A native release stops the capture
  // itself, but a browser's MediaRecorder keeps the microphone open until it is stopped.
  useEffect(
    () => () => {
      if (Platform.OS === "web" && recorder.isRecording) void recorder.stop();
    },
    [recorder],
  );

  const begin = useCallback(async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone access is off");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setClosedMillis(0);
    await begin();
  }, [begin]);

  /** Closes the current segment; null when nothing was captured. */
  const close = useCallback(async (): Promise<Segment | null> => {
    const segmentMillis = recorder.getStatus().durationMillis;
    await recorder.stop();
    setClosedMillis((total) => total + segmentMillis);
    const uri = recorder.uri;
    if (!uri) return null;
    const blob = await (await fetch(uri)).blob();
    // Only a browser's recording says what it is; a phone's file is read as the preset's .m4a.
    return { blob, contentType: recordingContentType(Platform.OS === "web" ? blob.type : "") };
  }, [recorder]);

  /** Closes the current segment and keeps recording into a new one. */
  const cut = useCallback(async () => {
    const segment = await close();
    await begin();
    return segment;
  }, [begin, close]);

  return {
    durationMillis: closedMillis + (state.isRecording ? state.durationMillis : 0),
    segmentMillis: state.isRecording ? state.durationMillis : 0,
    level: meterLevel(state.metering),
    start,
    cut,
    stop: close,
  };
}
