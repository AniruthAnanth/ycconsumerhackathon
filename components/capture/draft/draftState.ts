import type { Draft, DraftTask } from "../backend";

import { removeTask, renameTask } from "./lineupEdit";

export type DraftPhase = "idle" | "recording" | "drafting" | "revealing" | "review" | "locking";

export type DraftState = {
  phase: DraftPhase;
  transcript: string;
  tasks: DraftTask[];
  error: string | null;
  /** Set once the microphone fails, so the typed fallback stays on screen instead of dead-ending. */
  micUnavailable: boolean;
  /** The lineup under review was picked by hand, not drafted from what the player said. */
  manual: boolean;
};

export type DraftAction =
  | { type: "recordingStarted" }
  | { type: "recordingFailed"; message: string }
  | { type: "draftRequested" }
  | { type: "draftSucceeded"; result: Draft }
  | { type: "draftFailed"; message: string }
  | { type: "revealFinished" }
  | { type: "manualStarted"; tasks: DraftTask[] }
  | { type: "taskRenamed"; index: number; title: string }
  | { type: "taskRemoved"; index: number }
  | { type: "lockRequested" }
  | { type: "lockFailed"; message: string }
  | { type: "redone" };

export const initialDraftState: DraftState = {
  phase: "idle",
  transcript: "",
  tasks: [],
  error: null,
  micUnavailable: false,
  manual: false,
};

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "recordingStarted":
      return state.phase === "idle" ? { ...state, phase: "recording", error: null } : state;
    case "recordingFailed":
      return state.phase === "idle" || state.phase === "recording"
        ? { ...state, phase: "idle", error: action.message, micUnavailable: true }
        : state;
    case "draftRequested":
      return state.phase === "idle" || state.phase === "recording"
        ? { ...state, phase: "drafting", error: null }
        : state;
    case "draftSucceeded":
      return state.phase === "drafting"
        ? { ...state, phase: "revealing", transcript: action.result.transcript, tasks: action.result.tasks }
        : state;
    case "draftFailed":
      return state.phase === "drafting" ? { ...state, phase: "idle", error: action.message } : state;
    case "revealFinished":
      return state.phase === "revealing" ? { ...state, phase: "review" } : state;
    case "manualStarted":
      // Skipping the voice note lands on the same review step a draft ends in, so editing and
      // locking are one piece of code whichever way the lineup arrived.
      return state.phase === "idle"
        ? { ...state, phase: "review", transcript: "", tasks: action.tasks, error: null, manual: true }
        : state;
    case "taskRenamed":
      return state.phase === "review" ? { ...state, tasks: renameTask(state.tasks, action.index, action.title) } : state;
    case "taskRemoved":
      return state.phase === "review" ? { ...state, tasks: removeTask(state.tasks, action.index) } : state;
    case "lockRequested":
      return state.phase === "review" ? { ...state, phase: "locking", error: null } : state;
    case "lockFailed":
      return state.phase === "locking" ? { ...state, phase: "review", error: action.message } : state;
    case "redone":
      return state.phase === "review" ? { ...initialDraftState, micUnavailable: state.micUnavailable } : state;
  }
}
