import { getThumbnailAsync } from "expo-video-thumbnails";
import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useReducer, useRef } from "react";

import { capture as captureApi } from "@/components/capture/backend";
import type { Id } from "@/convex/_generated/dataModel";

import { errorMessage } from "../errorMessage";
import { uploadToConvex } from "../uploadToConvex";
import type { Capture, ProofTarget } from "../proofRoute";
import { submitProof, type ProofBackend } from "./submitProof";
import { initialPhase, nextPhase } from "./verdictPhase";

const REFEREE_UNREACHABLE = "The referee could not be reached.";

/** Submits the capture once when the screen opens, and again on every retry. */
export function useSubmitProof(target: ProofTarget, capture: Capture) {
  const requestUploadUrl = useMutation(captureApi.proofs.generateUploadUrl);
  const verifyMedia = useAction(captureApi.proofs.verify);
  const verifyCanvasTask = useAction(captureApi.canvas.verify);
  const [phase, dispatch] = useReducer(nextPhase, initialPhase);
  const started = useRef(false);

  const run = useCallback(async () => {
    const backend: ProofBackend = {
      generateUploadUrl: () => requestUploadUrl({}),
      uploadMedia: uploadToConvex,
      captureStill: async (videoUri, time) => (await getThumbnailAsync(videoUri, { time, quality: 0.6 })).uri,
      verifyMedia: ({ taskId, storageId, frameStorageIds, ...rest }) =>
        verifyMedia({
          ...rest,
          taskId: taskId as Id<"tasks">,
          storageId: storageId as Id<"_storage">,
          frameStorageIds: frameStorageIds as Id<"_storage">[] | undefined,
        }),
      verifyCanvas: ({ taskId }) => verifyCanvasTask({ taskId: taskId as Id<"tasks"> }),
    };
    try {
      dispatch({ type: "verdict", verdict: await submitProof(backend, target.taskId, capture) });
    } catch (error) {
      dispatch({ type: "failure", message: errorMessage(error, REFEREE_UNREACHABLE) });
    }
  }, [capture, requestUploadUrl, target.taskId, verifyCanvasTask, verifyMedia]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const retry = useCallback(() => {
    dispatch({ type: "submit" });
    void run();
  }, [run]);

  return { phase, retry };
}
