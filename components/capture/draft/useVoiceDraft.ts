import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import { announceLineupLocked } from "@/lib/notifications/lineupLock";

import { capture } from "../backend";
import { uploadToConvex } from "../uploadToConvex";
import { draftReducer, initialDraftState } from "./draftState";
import { draftWeekNote } from "./draftWeek";
import { canLock, tasksToLock } from "./lineupEdit";
import { manualLineup } from "./manualLineup";
import { hasReachedLimit } from "./recordingMeter";
import { useVoiceRecorder } from "./useVoiceRecorder";

type DraftInput = { audioStorageId?: Id<"_storage">; transcript?: string };

const DRAFT_FAILED = "Couldn't draft your week. Try again.";
const LOCK_FAILED = "Couldn't lock your lineup. Try again.";
const REFINE_FAILED = "Couldn't change your lineup. Try again.";
const MIC_FAILED = "Couldn't record. Type your week instead.";

/** Everything Voice Draft does: record, upload, draft (or skip to picking by hand), edit and lock. The screen only renders it. */
export function useVoiceDraft() {
  const router = useRouter();
  const [state, dispatch] = useReducer(draftReducer, initialDraftState);
  const recorder = useVoiceRecorder();
  const generateUploadUrl = useMutation(capture.proofs.generateUploadUrl);
  const draft = useAction(capture.lineup.draft);
  const lock = useMutation(capture.lineup.lock);
  const refineLineup = useAction(capture.lineup.refine);
  const starting = useRef(false);
  const thisWeek = useQuery(backend.lineup.roster, {});
  // The first answer holds for the whole visit. Our own lock flips the live one a moment before
  // the screen closes, and the note must not flash on the way out.
  const [lockedOnArrival, setLockedOnArrival] = useState<boolean>();
  if (lockedOnArrival === undefined && thisWeek) setLockedOnArrival(thisWeek.locked);

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
        const recording = await recorder.stop();
        if (!recording) throw new Error("Nothing was recorded");
        const uploadUrl = await generateUploadUrl({});
        const storageId = await uploadToConvex(uploadUrl, recording.uri, recording.contentType);
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
      // The player's own lock is when the notifications host may ask for permission.
      announceLineupLocked();
      haptics.success();
      router.replace("/(tabs)");
    } catch (error) {
      haptics.error();
      dispatch({ type: "lockFailed", message: errorMessage(error, LOCK_FAILED) });
    }
  }, [lock, router, state.phase, state.tasks, state.transcript]);

  /** Sends the lineup as it stands with a typed change; the reply replaces it, re-rated. */
  const refine = useCallback(
    async (instruction: string) => {
      const said = instruction.trim();
      if (state.phase !== "review" || state.refining || said === "") return false;
      dispatch({ type: "refineRequested" });
      try {
        const { tasks } = await refineLineup({ previousLineup: tasksToLock(state.tasks), instruction: said });
        dispatch({ type: "refineSucceeded", tasks });
        return true;
      } catch (error) {
        dispatch({ type: "refineFailed", message: errorMessage(error, REFINE_FAILED) });
        return false;
      }
    },
    [refineLineup, state.phase, state.refining, state.tasks],
  );

  useEffect(() => {
    if (state.phase === "recording" && hasReachedLimit(recorder.durationMillis)) void stopRecording();
  }, [state.phase, recorder.durationMillis, stopRecording]);

  return {
    state,
    durationMillis: recorder.durationMillis,
    level: recorder.level,
    weekNote: draftWeekNote(lockedOnArrival),
    canLock: state.phase === "review" && !state.refining && canLock(state.tasks),
    refine,
    /** A title edited by hand gets its points re-rated once the player leaves the field. */
    rerate: (title: string) => refine(`Re-rate the points for the edited task "${title.trim()}". Change nothing else.`),
    toggleRecording: state.phase === "recording" ? stopRecording : startRecording,
    draftFromText,
    lockLineup,
    pickOwn: useCallback(() => dispatch({ type: "manualStarted", tasks: manualLineup() }), []),
    finishReveal: useCallback(() => dispatch({ type: "revealFinished" }), []),
    renameTask: useCallback((index: number, title: string) => dispatch({ type: "taskRenamed", index, title }), []),
    removeTask: useCallback((index: number) => dispatch({ type: "taskRemoved", index }), []),
    redo: useCallback(() => dispatch({ type: "redone" }), []),
  };
}
