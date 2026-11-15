import type { Verdict } from "@/components/capture/backend";

import type { Capture } from "../proofRoute";

export type VerifyMediaArgs = {
  taskId: string;
  storageId: string;
  mediaType: "photo" | "video";
  frameStorageIds?: string[];
  lat?: number;
  lng?: number;
  beforeStorageId?: string;
  durationSec?: number;
  capturedAt?: number;
  frameTimes?: number[];
};

/** The calls submitProof needs, injected so it runs without React, a network or a camera. */
export type ProofBackend = {
  generateUploadUrl: () => Promise<string>;
  uploadMedia: (uploadUrl: string, uri: string, contentType: string) => Promise<string>;
  /** A JPEG still of the clip at the given millisecond, as a local file uri. */
  captureStill: (videoUri: string, timeMs: number) => Promise<string>;
  verifyMedia: (args: VerifyMediaArgs) => Promise<Verdict>;
  verifyCanvas: (args: { taskId: string }) => Promise<Verdict>;
};

export const STILL_POSITIONS = [0.15, 0.5, 0.85];
export const FALLBACK_CLIP_MS = 3000;

export function contentTypeFor(mediaType: "photo" | "video", uri: string): string {
  if (mediaType === "photo") return "image/jpeg";
  return uri.toLowerCase().split("?")[0].endsWith(".mov") ? "video/quicktime" : "video/mp4";
}

/** The model cannot read video, so the referee is also shown stills sampled across the clip. */
export function stillTimes(durationMs: number | undefined): number[] {
  const length = durationMs ?? FALLBACK_CLIP_MS;
  return STILL_POSITIONS.map((position) => Math.round(length * position));
}

/** Uploads the capture and asks the referee; a Canvas capture has no media, so it only asks. */
export async function submitProof(backend: ProofBackend, taskId: string, capture: Capture): Promise<Verdict> {
  if (capture.mediaType === "canvas") return backend.verifyCanvas({ taskId });

  const upload = async (uri: string, contentType: string) =>
    backend.uploadMedia(await backend.generateUploadUrl(), uri, contentType);
  const { lat, lng } = capture;

  if (capture.mediaType === "photo") {
    const { beforeUri, frames, capturedAt } = capture;
    // A timelapse sends only its stills: half an hour of video is too big to upload. The last still is the proof's own image.
    const stills = frames?.slice(0, -1) ?? [];
    const [storageId, beforeStorageId, ...frameIds] = await Promise.all([
      upload(capture.uri, "image/jpeg"),
      beforeUri ? upload(beforeUri, "image/jpeg") : Promise.resolve(undefined),
      ...stills.map((frame) => upload(frame.uri, "image/jpeg")),
    ]);
    return backend.verifyMedia({
      taskId,
      storageId,
      mediaType: "photo",
      lat,
      lng,
      ...(capturedAt !== undefined && { capturedAt }),
      ...(beforeStorageId && { beforeStorageId }),
      ...(frames?.length && {
        frameStorageIds: [...(frameIds as string[]), storageId],
        frameTimes: frames.map((frame) => frame.at),
        durationSec: Math.round((capture.durationMs ?? 0) / 1000),
      }),
    });
  }

  const stills = await Promise.all(stillTimes(capture.durationMs).map((time) => backend.captureStill(capture.uri, time)));
  const [storageId, ...frameStorageIds] = await Promise.all([
    upload(capture.uri, contentTypeFor("video", capture.uri)),
    ...stills.map((still) => upload(still, "image/jpeg")),
  ]);
  return backend.verifyMedia({ taskId, storageId, mediaType: "video", frameStorageIds, lat, lng });
}
