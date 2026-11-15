import { describe, expect, it } from "vitest";

import { draftReducer, initialDraftState, type DraftAction, type DraftState } from "./draftState";
import type { DraftTask } from "./types";

const body: DraftTask = { slot: "body", title: "Leg day", points: 10, proofType: "photo_location" };
const flex: DraftTask = { slot: "flex", title: "5k run", points: 5, proofType: "photo" };
const result = { transcript: "leg day and a run", tasks: [body, flex] };

function run(actions: DraftAction[], from: DraftState = initialDraftState): DraftState {
  return actions.reduce(draftReducer, from);
}

const reviewing = run([
  { type: "draftRequested" },
  { type: "draftSucceeded", result },
  { type: "revealFinished" },
]);

describe("recording to review", () => {
  it("walks idle, recording, drafting, revealing, review", () => {
    expect(run([{ type: "recordingStarted" }]).phase).toBe("recording");
    expect(run([{ type: "recordingStarted" }, { type: "draftRequested" }]).phase).toBe("drafting");
    const revealing = run([{ type: "draftRequested" }, { type: "draftSucceeded", result }]);
    expect(revealing).toMatchObject({ phase: "revealing", transcript: result.transcript, tasks: result.tasks });
    expect(reviewing.phase).toBe("review");
  });

  it("returns to idle with the message when drafting fails", () => {
    const state = run([{ type: "draftRequested" }, { type: "draftFailed", message: "Couldn't hear a plan" }]);
    expect(state).toMatchObject({ phase: "idle", error: "Couldn't hear a plan", micUnavailable: false });
  });

  it("keeps the typed fallback once the microphone fails", () => {
    const state = run([{ type: "recordingStarted" }, { type: "recordingFailed", message: "Microphone is off" }]);
    expect(state).toMatchObject({ phase: "idle", error: "Microphone is off", micUnavailable: true });
  });

  it("clears the error when recording starts again", () => {
    const failed = run([{ type: "draftRequested" }, { type: "draftFailed", message: "x" }]);
    expect(draftReducer(failed, { type: "recordingStarted" }).error).toBeNull();
  });

  it("ignores actions that do not fit the phase", () => {
    expect(draftReducer(initialDraftState, { type: "draftSucceeded", result })).toBe(initialDraftState);
    expect(draftReducer(initialDraftState, { type: "lockRequested" })).toBe(initialDraftState);
    expect(draftReducer(reviewing, { type: "recordingStarted" })).toBe(reviewing);
  });
});

describe("review edits", () => {
  it("renames and removes tasks only in review", () => {
    const renamed = draftReducer(reviewing, { type: "taskRenamed", index: 0, title: "Back day" });
    expect(renamed.tasks[0].title).toBe("Back day");
    expect(draftReducer(renamed, { type: "taskRemoved", index: 1 }).tasks).toHaveLength(1);
    expect(draftReducer(renamed, { type: "taskRemoved", index: 0 }).tasks).toHaveLength(2);
    const revealing = run([{ type: "draftRequested" }, { type: "draftSucceeded", result }]);
    expect(draftReducer(revealing, { type: "taskRenamed", index: 0, title: "x" })).toBe(revealing);
  });
});

describe("locking", () => {
  it("returns to review with the message when locking fails", () => {
    const state = run([{ type: "lockRequested" }, { type: "lockFailed", message: "Try again" }], reviewing);
    expect(state).toMatchObject({ phase: "review", error: "Try again" });
    expect(state.tasks).toEqual(result.tasks);
  });
});

describe("redo", () => {
  it("discards the draft and keeps the microphone fallback", () => {
    const state = draftReducer({ ...reviewing, micUnavailable: true }, { type: "redone" });
    expect(state).toEqual({ ...initialDraftState, micUnavailable: true });
  });

  it("is only available from review", () => {
    expect(draftReducer(initialDraftState, { type: "redone" })).toBe(initialDraftState);
  });
});
