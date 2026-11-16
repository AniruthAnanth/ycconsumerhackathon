import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { createClipper, pcmLevel, wavFromPcm16 } from "./pcmChunks";
import { meterLevel } from "./recordingMeter";
import { recordingContentType } from "./recordingType";

/** 16 kHz mono is what speech transcription uses anyway, and keeps a live clip near 32 KB. */
const STREAM_SAMPLE_RATE = 16_000;

/**
 * A phone streams its microphone as PCM: one continuous take with nothing lost between live clips.
 * The browser has no stream, and an Expo Go older than the stream API has no native class for it,
 * so both fall back to the segmented recorder. Decided once, so the same hook runs on every render.
 */
const STREAMS = Platform.OS !== "web" && typeof (AudioModule as { AudioStream?: unknown }).AudioStream === "function";

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** One finished stretch of recording, read into memory before the next stretch can reuse the file. */
export type Segment = { blob: Blob; contentType: string };

/**
 * Records in segments: cut() closes the current file and starts a new one straight away, so each
 * segment can be transcribed while the player keeps talking. A file still being written can't be
 * read (an .m4a is only playable once closed), which is why the recording is cut rather than read.
 */
function useSegmentRecorder() {
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
    kind: "segments" as const,
    durationMillis: closedMillis + (state.isRecording ? state.durationMillis : 0),
    segmentMillis: state.isRecording ? state.durationMillis : 0,
    level: meterLevel(state.metering),
    start,
    cut,
    stop: close,
  };
}

/** A finished streamed take: one WAV file of the whole thing, for the full-quality transcription. */
export type Take = { uri: string; contentType: string };

/**
 * Streams the microphone: every LIVE_CLIP_MS of audio is handed to onClip as a short WAV that
 * overlaps the one before, while the whole take is written to one WAV file alongside.
 */
function useStreamRecorder() {
  const [durationMillis, setDurationMillis] = useState(0);
  const [level, setLevel] = useState(0);
  // Remade at the first buffer's rate: the hardware may not deliver the rate asked for, and a
  // clip a second long has to be counted in the samples that actually arrive.
  const clipper = useRef({ rate: STREAM_SAMPLE_RATE, clips: createClipper(STREAM_SAMPLE_RATE) });
  const onClip = useRef<(wav: Uint8Array) => void>(() => undefined);

  const onBuffer = useCallback((buffer: AudioStreamBuffer) => {
    const samples = new Int16Array(buffer.data);
    setLevel(pcmLevel(samples));
    setDurationMillis(Math.round(buffer.timestamp * 1000));
    if (clipper.current.rate !== buffer.sampleRate) clipper.current = { rate: buffer.sampleRate, clips: createClipper(buffer.sampleRate) };
    for (const clip of clipper.current.clips.push(samples)) onClip.current(wavFromPcm16(clip, buffer.sampleRate));
  }, []);
  const { stream } = useAudioStream({ sampleRate: STREAM_SAMPLE_RATE, channels: 1, encoding: "int16", onBuffer });

  useEffect(
    () => () => {
      if (stream.isStreaming) stream.stop();
    },
    [stream],
  );

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone access is off");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    clipper.current = { rate: STREAM_SAMPLE_RATE, clips: createClipper(STREAM_SAMPLE_RATE) };
    setDurationMillis(0);
    await stream.start();
    await stream.startFileRecordingAsync({ format: "wav" });
  }, [stream]);

  /** Ends the take; the last part-second still goes to onClip. Null when nothing was captured. */
  const stop = useCallback(async (): Promise<Take | null> => {
    const take = await stream.stopFileRecordingAsync().catch(() => null);
    stream.stop();
    setLevel(0);
    const rest = clipper.current.clips.flush();
    if (rest) onClip.current(wavFromPcm16(rest, clipper.current.rate));
    return take && take.duration > 0 ? { uri: take.uri, contentType: "audio/wav" } : null;
  }, [stream]);

  return {
    kind: "stream" as const,
    durationMillis,
    level,
    start,
    stop,
    setOnClip: (handler: (wav: Uint8Array) => void) => {
      onClip.current = handler;
    },
  };
}

export type VoiceRecorder = ReturnType<typeof useSegmentRecorder> | ReturnType<typeof useStreamRecorder>;

export const useVoiceRecorder: () => VoiceRecorder = STREAMS ? useStreamRecorder : useSegmentRecorder;
