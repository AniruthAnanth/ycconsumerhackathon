import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { CameraView } from "expo-camera";

import { getDevFlags } from "@/lib/devFlags";

import { DEFAULT_TARGET_MINUTES, frameTimesMs, intervalMs, pickEvenly, SURVEY_FRAMES, SURVEY_SECONDS, timelapseCapSeconds } from "../proofKinds";
import { sampleUri, type SampleMedia } from "../samples";
import { verdictHref, type Capture, type ProofTarget } from "../proofRoute";
import { captureStill } from "../verdict/captureStill";
import { resolveCaptureCoords } from "./captureCoords";
import { deviceGps } from "./deviceLocation";
import { MAX_VIDEO_SECONDS, recordedDurationMs, secondsLeft } from "./recording";

const PHOTO_QUALITY = 0.6;
const KEEP_AWAKE_TAG = "timelapse";

/** expo-keep-awake throws when releasing a lock it never took, which every photo proof would do. */
function releaseAwake(held: { current: boolean }) {
  if (!held.current) return;
  held.current = false;
  void Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => undefined);
}

/** photo and video for every camera task; a timelapse task records with timelapse, or interval photos as the fallback. */
export type CaptureMode = "photo" | "video" | "timelapse" | "interval" | "survey";

type Frame = { uri: string; at: number };

/** A finished timelapse the player looks over before it is sent. */
export type TimelapseReview = { frames: Frame[]; durationMs: number; /** A survey video's clip, which is sent along with its stills. */ videoUri?: string };

/** With bundled samples instead of a camera, a stand-in "shot" every second makes the timelapse watchable in a demo. */
const SAMPLE_SHOT_MS = 1000;

/** Shutter, recording and hand-off to the verdict screen for one proof attempt. */
export function useProofCapture(target: ProofTarget) {
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const recordingStartedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const shooter = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalFrames = useRef<Frame[]>([]);
  const awake = useRef(false);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [before, setBefore] = useState<Frame | null>(null);
  const [review, setReview] = useState<TimelapseReview | null>(null);
  const targetMinutes = target.targetMinutes ?? DEFAULT_TARGET_MINUTES;

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
      if (shooter.current) clearInterval(shooter.current);
      releaseAwake(awake);
    },
    [],
  );

  async function finish(media: Extract<Capture, { uri: string }>) {
    const coords = await resolveCaptureCoords({ flags: getDevFlags(), place: target.place, gps: deviceGps });
    router.replace(verdictHref(target, { capturedAt: Date.now(), ...media, lat: coords?.lat, lng: coords?.lng }));
  }

  function stopTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setRemaining(null);
    setElapsedMs(null);
  }

  function startElapsed() {
    recordingStartedAt.current = Date.now();
    setElapsedMs(0);
    // A long timelapse with the screen going dark would stop the camera, so the phone stays awake until it ends.
    awake.current = true;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    ticker.current = setInterval(() => setElapsedMs(Date.now() - recordingStartedAt.current), 500);
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
      releaseAwake(awake);
      setBusy(false);
    }
  }

  async function shoot(): Promise<Frame> {
    // The web camera writes PNG unless told otherwise, and the upload is labelled image/jpeg.
    const photo = await camera.current!.takePictureAsync({ quality: PHOTO_QUALITY, imageType: "jpg" });
    return { uri: photo.uri, at: Date.now() };
  }

  /** Before/after takes two shots: the first is kept and ghosted over the preview for the second. */
  async function finishPhoto(shot: Frame) {
    if (target.proofType === "before_after" && !before) {
      setBefore(shot);
      return;
    }
    await finish({ mediaType: "photo", uri: shot.uri, capturedAt: shot.at, beforeUri: before?.uri });
  }

  function takePhoto() {
    if (busy || !camera.current) return;
    return guarded(async () => finishPhoto(await shoot()));
  }

  function startRecording() {
    if (busy || !camera.current) return;
    return guarded(async () => {
      recordingStartedAt.current = Date.now();
      setRemaining(MAX_VIDEO_SECONDS);
      ticker.current = setInterval(() => setRemaining(secondsLeft(Date.now() - recordingStartedAt.current)), 250);
      const video = await camera.current!.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (!video?.uri) throw new Error("recording produced no file");
      const durationMs = recordedDurationMs(recordingStartedAt.current, Date.now());
      stopTicker();
      await finish({ mediaType: "video", uri: video.uri, durationMs });
    });
  }

  /** Records the whole stretch, then keeps only eight stills from it: the clip itself is never uploaded. */
  function startTimelapse() {
    if (busy || !camera.current) return;
    return guarded(async () => {
      startElapsed();
      const startedAt = recordingStartedAt.current;
      const video = await camera.current!.recordAsync({ maxDuration: timelapseCapSeconds(targetMinutes) });
      if (!video?.uri) throw new Error("recording produced no file");
      const endedAt = Date.now();
      stopTicker();
      const durationMs = endedAt - startedAt;
      const frames: Frame[] = [];
      for (const time of frameTimesMs(durationMs)) {
        frames.push({ uri: await captureStill(video.uri, time), at: startedAt + time });
      }
      setReview({ frames, durationMs });
    });
  }

  /** A survey video: five seconds panning over the result. The clip is short enough to send, along with five stills from it. */
  function startSurvey() {
    if (busy || !camera.current) return;
    return guarded(async () => {
      recordingStartedAt.current = Date.now();
      setRemaining(SURVEY_SECONDS);
      ticker.current = setInterval(() => setRemaining(secondsLeft(Date.now() - recordingStartedAt.current, SURVEY_SECONDS)), 250);
      const video = await camera.current!.recordAsync({ maxDuration: SURVEY_SECONDS });
      if (!video?.uri) throw new Error("recording produced no file");
      const durationMs = recordedDurationMs(recordingStartedAt.current, Date.now(), SURVEY_SECONDS);
      stopTicker();
      setReview(await surveyReview(video.uri, recordingStartedAt.current, durationMs));
    });
  }

  /** The fallback for phones that can't hold a long recording: one photo now and one every target/8. */
  function startInterval() {
    if (busy || !camera.current) return;
    shootEvery(shoot, intervalMs(targetMinutes));
  }

  function shootEvery(take: () => Promise<Frame>, everyMs: number) {
    setBusy(true);
    intervalFrames.current = [];
    setFrameCount(0);
    startElapsed();
    const capture = async () => {
      try {
        intervalFrames.current.push(await take());
        setFrameCount(intervalFrames.current.length);
      } catch {
        // One missed shot doesn't end the timelapse; the next one is due soon.
      }
    };
    void capture();
    shooter.current = setInterval(() => void capture(), everyMs);
  }

  function stopInterval() {
    if (shooter.current) clearInterval(shooter.current);
    shooter.current = null;
    const durationMs = Date.now() - recordingStartedAt.current;
    const frames = pickEvenly(intervalFrames.current);
    return guarded(async () => {
      if (frames.length > 0) setReview({ frames, durationMs });
    });
  }

  function stopRecording() {
    if (shooter.current) return stopInterval();
    camera.current?.stopRecording();
  }

  function submitSample(sample: SampleMedia) {
    if (busy) return;
    return guarded(async () => {
      const uri = await sampleUri(sample);
      if (sample.mediaType === "photo" && target.proofType === "before_after") return finishPhoto({ uri, at: Date.now() });
      await finish({ mediaType: sample.mediaType, uri, durationMs: sample.durationMs });
    });
  }

  /** Development only: a bundled photo stands in for each shot of a timelapse, so the flow runs where there is no camera. */
  function startSampleTimelapse(sample: SampleMedia) {
    if (busy || sample.mediaType !== "photo") return;
    void sampleUri(sample).then((uri) => shootEvery(async () => ({ uri, at: Date.now() }), SAMPLE_SHOT_MS));
  }

  /** Development only: the bundled clip stands in for a survey video recorded on the spot. */
  function sampleSurvey(sample: SampleMedia) {
    if (busy || sample.mediaType !== "video") return;
    return guarded(async () => {
      const uri = await sampleUri(sample);
      setReview(await surveyReview(uri, Date.now(), sample.durationMs ?? SURVEY_SECONDS * 1000));
    });
  }

  /** Every proof is looked over before it is sent. */
  function submitReview() {
    if (busy || !review) return;
    const last = review.frames[review.frames.length - 1];
    const { frames, durationMs, videoUri } = review;
    return guarded(() =>
      videoUri
        ? finish({ mediaType: "video", uri: videoUri, capturedAt: last.at, durationMs, frames })
        : finish({ mediaType: "photo", uri: last.uri, capturedAt: last.at, durationMs, frames }),
    );
  }

  /** A screenshot proof is picked, not shot; it still goes through the same hand-off. */
  function submitPicked(uri: string) {
    if (busy) return;
    return guarded(() => finish({ mediaType: "photo", uri }));
  }

  return {
    camera,
    submitPicked,
    busy,
    recording: remaining !== null || elapsedMs !== null,
    secondsRemaining: remaining,
    elapsedMs,
    frameCount,
    targetMinutes,
    before,
    retakeBefore: () => setBefore(null),
    cameraFailed,
    markCameraFailed: () => setCameraFailed(true),
    retryCamera: () => setCameraFailed(false),
    takePhoto,
    startRecording,
    startTimelapse,
    startInterval,
    stopRecording,
    submitSample,
    startSampleTimelapse,
    startSurvey,
    sampleSurvey,
    review,
    submitReview,
    retake: () => setReview(null),
  };
}

async function surveyReview(videoUri: string, startedAt: number, durationMs: number): Promise<TimelapseReview> {
  const frames: Frame[] = [];
  for (const time of frameTimesMs(durationMs, SURVEY_FRAMES)) {
    frames.push({ uri: await captureStill(videoUri, time), at: startedAt + time });
  }
  return { frames, durationMs, videoUri };
}
