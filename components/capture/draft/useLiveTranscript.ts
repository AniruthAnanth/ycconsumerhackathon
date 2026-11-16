import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { joinTranscripts, shouldCutSegment } from "@/convex/lib/liveTranscript";

import { capture } from "../backend";
import { uploadToConvex } from "../uploadToConvex";
import { MAX_RECORDING_MS } from "./recordingMeter";
import type { Segment, useVoiceRecorder } from "./useVoiceRecorder";

type Recorder = ReturnType<typeof useVoiceRecorder>;

/**
 * The words that appear while the player talks. Every couple of seconds the recording is cut, the
 * closed segment uploaded and transcribed by the fast model, and its words appended. It is best
 * effort: a segment that fails shows nothing. finish() hands back every uploaded segment so the
 * draft is made from one full-quality transcription of the whole take.
 */
export function useLiveTranscript(recorder: Recorder, recording: boolean) {
  const generateUploadUrl = useMutation(capture.proofs.generateUploadUrl);
  const transcribeChunk = useAction(capture.liveTranscribe.chunk);
  const [parts, setParts] = useState<string[]>([]);
  const uploads = useRef<Promise<Id<"_storage"> | null>[]>([]);
  const cutting = useRef<Promise<void> | null>(null);

  const keep = useCallback(
    (segment: Segment | null) => {
      if (!segment) return;
      const index = uploads.current.length;
      const upload = generateUploadUrl({})
        .then((url) => uploadToConvex(url, segment.blob, segment.contentType))
        .then((id) => id as Id<"_storage">)
        .catch(() => null);
      uploads.current.push(upload);
      void upload
        .then((storageId) => (storageId ? transcribeChunk({ storageId }) : ""))
        .then((text) =>
          setParts((current) => {
            const next = [...current];
            next[index] = text;
            return next;
          }),
        )
        .catch(() => undefined);
    },
    [generateUploadUrl, transcribeChunk],
  );

  const reset = useCallback(() => {
    uploads.current = [];
    cutting.current = null;
    setParts([]);
  }, []);

  useEffect(() => {
    const due = shouldCutSegment({
      segmentMillis: recorder.segmentMillis,
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
  }, [recording, recorder, keep]);

  /** Stops the recording and resolves to every segment that uploaded, in recording order. */
  const finish = useCallback(async () => {
    await cutting.current;
    keep(await recorder.stop());
    const ids = await Promise.all(uploads.current);
    return ids.filter((id): id is Id<"_storage"> => id !== null);
  }, [keep, recorder]);

  return { text: joinTranscripts(parts), reset, finish };
}
