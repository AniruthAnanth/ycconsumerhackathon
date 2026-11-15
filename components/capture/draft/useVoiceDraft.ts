import { useAction, useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { Id } from "@/convex/_generated/dataModel";

import { capture } from "../backend";
import { errorMessage } from "../errorMessage";
import { uploadToConvex } from "../uploadToConvex";
import { draftReducer, initialDraftState } from "./draftState";
import { canLock, tasksToLock } from "./lineupEdit";
import { hasReachedLimit } from "./recordingMeter";
import { useVoiceRecorder } from "./useVoiceRecorder";

type DraftInput = { audioStorageId?: Id<"_storage">; transcript?: string };

const DRAFT_FAILED = "Couldn't draft your week. Try again.";
const LOCK_FAILED = "Couldn't lock your lineup. Try again.";
const MIC_FAILED = "Couldn't record. Type your week instead.";

/** Everything Voice Draft does: record, upload, draft, edit and lock. The screen only renders it. */
export function useVoiceDraft() {
  const router = useRouter();
  const [state, dispatch] = useReducer(draftReducer, initialDraftState);
  const recorder = useVoiceRecorder();
  const generateUploadUrl = useMutation(capture.proofs.generateUploadUrl);
  const draft = useAction(capture.lineup.draft);
  const lock = useMutation(capture.lineup.lock);
  const starting = useRef(false);

  const requestDraft = useCallback(
    async (buildInput: () => Promise<DraftInput>) => {
      dispatch({ type: "draftRequested" });
      try {
        const result = await draft(await buildInput());
        dispatch({ type: "draftSucceeded", result });
      } catch (error) {
        dispatch({ type: "draftFailed", message: errorMessage(error, DRAFT_FAILED) });
      }
    },
    [draft],
  );

  const startRecording = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    try {
      await recorder.start();
      dispatch({ type: "recordingStarted" });
    } catch {
      dispatch({ type: "recordingFailed", message: MIC_FAILED });
    } finally {
      starting.current = false;
    }
  }, [recorder]);

  const stopRecording = useCallback(
    () =>
      requestDraft(async () => {
        const uri = await recorder.stop();
        if (!uri) throw new Error("Nothing was recorded");
        const uploadUrl = await generateUploadUrl({});
        const storageId = await uploadToConvex(uploadUrl, uri, "audio/m4a");
        return { audioStorageId: storageId as Id<"_storage"> };
      }),
    [generateUploadUrl, recorder, requestDraft],
  );

  const draftFromText = useCallback(
    (transcript: string) => requestDraft(async () => ({ transcript: transcript.trim() })),
    [requestDraft],
  );

  const lockLineup = useCallback(async () => {
    if (state.phase !== "review" || !canLock(state.tasks)) return;
    dispatch({ type: "lockRequested" });
    try {
      await lock({ tasks: tasksToLock(state.tasks), transcript: state.transcript });
      router.replace("/(tabs)");
    } catch (error) {
      dispatch({ type: "lockFailed", message: errorMessage(error, LOCK_FAILED) });
    }
  }, [lock, router, state.phase, state.tasks, state.transcript]);

  useEffect(() => {
    if (state.phase === "recording" && hasReachedLimit(recorder.durationMillis)) void stopRecording();
  }, [state.phase, recorder.durationMillis, stopRecording]);

  return {
    state,
    durationMillis: recorder.durationMillis,
    level: recorder.level,
    canLock: state.phase === "review" && canLock(state.tasks),
    toggleRecording: state.phase === "recording" ? stopRecording : startRecording,
    draftFromText,
    lockLineup,
    finishReveal: useCallback(() => dispatch({ type: "revealFinished" }), []),
    renameTask: useCallback((index: number, title: string) => dispatch({ type: "taskRenamed", index, title }), []),
    removeTask: useCallback((index: number) => dispatch({ type: "taskRemoved", index }), []),
    redo: useCallback(() => dispatch({ type: "redone" }), []),
  };
}
