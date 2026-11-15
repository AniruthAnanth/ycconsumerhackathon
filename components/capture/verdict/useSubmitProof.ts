import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useReducer, useRef } from "react";

import { capture as captureApi } from "@/components/capture/backend";
import type { Id } from "@/convex/_generated/dataModel";

import { errorMessage } from "../errorMessage";
import { uploadToConvex } from "../uploadToConvex";
import type { Capture, ProofTarget } from "../proofRoute";
import { captureStill } from "./captureStill";
import { submitProof, type ProofBackend } from "./submitProof";
import { initialPhase, nextPhase } from "./verdictPhase";

const REFEREE_UNREACHABLE = "The referee could not be reached.";

/**
 * Submits the capture once when the screen opens, and again on every retry.
 *
 * `beforeVerify` is awaited after the upload and before the referee is asked about a photo or
 * video. The on-device pre-check uses it to hold a server verification back while the player
 * decides whether to retake a photo that plainly doesn't match.
 */
export function useSubmitProof(target: ProofTarget, capture: Capture, beforeVerify?: () => Promise<void>) {
  const requestUploadUrl = useMutation(captureApi.proofs.generateUploadUrl);
  const verifyMedia = useAction(captureApi.proofs.verify);
  const verifyCanvasTask = useAction(captureApi.canvas.verify);
  const [phase, dispatch] = useReducer(nextPhase, initialPhase);
  const started = useRef(false);

  const run = useCallback(async () => {
    const backend: ProofBackend = {
      generateUploadUrl: () => requestUploadUrl({}),
      uploadMedia: uploadToConvex,
      captureStill,
      verifyMedia: async ({ taskId, storageId, frameStorageIds, ...rest }) => {
        await beforeVerify?.();
        return verifyMedia({
          ...rest,
          taskId: taskId as Id<"tasks">,
          storageId: storageId as Id<"_storage">,
          frameStorageIds: frameStorageIds as Id<"_storage">[] | undefined,
        });
      },
      verifyCanvas: ({ taskId }) => verifyCanvasTask({ taskId: taskId as Id<"tasks"> }),
    };
    try {
      dispatch({ type: "verdict", verdict: await submitProof(backend, target.taskId, capture) });
    } catch (error) {
      dispatch({ type: "failure", message: errorMessage(error, REFEREE_UNREACHABLE) });
    }
  }, [beforeVerify, capture, requestUploadUrl, target.taskId, verifyCanvasTask, verifyMedia]);

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
