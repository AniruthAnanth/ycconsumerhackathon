import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { joinTranscripts, shouldCutSegment } from "@/convex/lib/liveTranscript";

import { capture } from "../backend";
import { uploadToConvex } from "../uploadToConvex";
import { MAX_RECORDING_MS } from "./recordingMeter";
import type { Segment, VoiceRecorder } from "./useVoiceRecorder";

/** What the draft is made from once the player stops: one file of the whole take, or every segment in order. */
export type FinishedTake = { audioStorageId: Id<"_storage"> } | { storageIds: Id<"_storage">[] };

/**
 * The words that appear while the player talks. A phone streams its microphone and sends a short
 * clip every second, each overlapping the last; a browser cuts its recording every second instead.
 * Clips are transcribed in parallel by the fast model and shown in recording order as each answer
 * lands. It is best effort: a clip that fails shows nothing. finish() hands back what the draft's
 * one full-quality transcription reads.
 */
export function useLiveTranscript(recorder: VoiceRecorder, recording: boolean) {
  const generateUploadUrl = useMutation(capture.proofs.generateUploadUrl);
  const transcribeChunk = useAction(capture.liveTranscribe.chunk);
  const transcribeWav = useAction(capture.liveTranscribe.chunkWav);
  const [parts, setParts] = useState<string[]>([]);
  const clips = useRef(0);
  const uploads = useRef<Promise<Id<"_storage"> | null>[]>([]);
  const cutting = useRef<Promise<void> | null>(null);

  const show = useCallback((pending: Promise<string>) => {
    const index = clips.current++;
    void pending
      .then((text) =>
        setParts((current) => {
          const next = [...current];
          next[index] = text;
          return next;
        }),
      )
      .catch(() => undefined);
  }, []);

  const upload = useCallback(
    (file: string | Blob, contentType: string) =>
      generateUploadUrl({})
        .then((url) => uploadToConvex(url, file, contentType))
        .then((id) => id as Id<"_storage">),
    [generateUploadUrl],
  );

  if (recorder.kind === "stream") {
    recorder.setOnClip((wav) => show(transcribeWav({ wav: wav.buffer as ArrayBuffer })));
  }

  const keep = useCallback(
    (segment: Segment | null) => {
      if (!segment) return;
      const pending = upload(segment.blob, segment.contentType).catch(() => null);
      uploads.current.push(pending);
      show(pending.then((storageId) => (storageId ? transcribeChunk({ storageId }) : "")));
    },
    [show, transcribeChunk, upload],
  );

  const reset = useCallback(() => {
    clips.current = 0;
    uploads.current = [];
    cutting.current = null;
    setParts([]);
  }, []);

  const segmentMillis = recorder.kind === "segments" ? recorder.segmentMillis : 0;
  useEffect(() => {
    if (recorder.kind !== "segments") return;
    const due = shouldCutSegment({
      segmentMillis,
      totalMillis: recorder.durationMillis,
      limitMillis: MAX_RECORDING_MS,
      cutting: cutting.current !== null,
    });
    if (!recording || !due) return;
    cutting.current = recorder
      .cut()
      .then(keep)
      .catch(() => undefined)
      .finally(() => {
        cutting.current = null;
      });
  }, [recording, recorder, segmentMillis, keep]);

  /** Stops the recording and resolves to what the draft is made from; throws when nothing was captured. */
  const finish = useCallback(async (): Promise<FinishedTake> => {
    if (recorder.kind === "stream") {
      const take = await recorder.stop();
      if (!take) throw new Error("Nothing was recorded");
      return { audioStorageId: await upload(take.uri, take.contentType) };
    }
    await cutting.current;
    keep(await recorder.stop());
    const ids = (await Promise.all(uploads.current)).filter((id): id is Id<"_storage"> => id !== null);
    if (ids.length === 0) throw new Error("Nothing was recorded");
    return ids.length === 1 ? { audioStorageId: ids[0] } : { storageIds: ids };
  }, [keep, recorder, upload]);

  return { text: joinTranscripts(parts), reset, finish };
}
