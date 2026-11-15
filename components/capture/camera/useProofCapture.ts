import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { CameraView } from "expo-camera";

import { getDevFlags } from "@/lib/devFlags";

import { sampleUri, type SampleMedia } from "../samples";
import { verdictHref, type Capture, type ProofTarget } from "../proofRoute";
import { resolveCaptureCoords } from "./captureCoords";
import { deviceGps } from "./deviceLocation";
import { MAX_VIDEO_SECONDS, recordedDurationMs, secondsLeft } from "./recording";

const PHOTO_QUALITY = 0.6;

export type CaptureMode = "photo" | "video";

/** Shutter, recording and hand-off to the verdict screen for one proof attempt. */
export function useProofCapture(target: ProofTarget) {
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const recordingStartedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
    },
    [],
  );

  async function finish(media: Extract<Capture, { uri: string }>) {
    const coords = await resolveCaptureCoords({ flags: getDevFlags(), place: target.place, gps: deviceGps });
    router.replace(verdictHref(target, { ...media, lat: coords?.lat, lng: coords?.lng }));
  }

  function stopTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setRemaining(null);
  }

  async function guarded(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      // A shot or clip that fails (a recording stopped before its first frame, a preview not yet
      // ready) leaves the camera running so the player can simply try again.
    } finally {
      stopTicker();
      setBusy(false);
    }
  }

  function takePhoto() {
    if (busy || !camera.current) return;
    return guarded(async () => {
      // The web camera writes PNG unless told otherwise, and the upload is labelled image/jpeg.
      const photo = await camera.current!.takePictureAsync({ quality: PHOTO_QUALITY, imageType: "jpg" });
      await finish({ mediaType: "photo", uri: photo.uri });
    });
  }

  function startRecording() {
    if (busy || !camera.current) return;
    return guarded(async () => {
      recordingStartedAt.current = Date.now();
      setRemaining(MAX_VIDEO_SECONDS);
      ticker.current = setInterval(
        () => setRemaining(secondsLeft(Date.now() - recordingStartedAt.current)),
        250,
      );
      const video = await camera.current!.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (!video?.uri) throw new Error("recording produced no file");
      const durationMs = recordedDurationMs(recordingStartedAt.current, Date.now());
      stopTicker();
      await finish({ mediaType: "video", uri: video.uri, durationMs });
    });
  }

  function stopRecording() {
    camera.current?.stopRecording();
  }

  function submitSample(sample: SampleMedia) {
    if (busy) return;
    return guarded(async () => {
      const uri = await sampleUri(sample);
      await finish({ mediaType: sample.mediaType, uri, durationMs: sample.durationMs });
    });
  }

  return {
    camera,
    busy,
    recording: remaining !== null,
    secondsRemaining: remaining,
    cameraFailed,
    markCameraFailed: () => setCameraFailed(true),
    retryCamera: () => setCameraFailed(false),
    takePhoto,
    startRecording,
    stopRecording,
    submitSample,
  };
}
