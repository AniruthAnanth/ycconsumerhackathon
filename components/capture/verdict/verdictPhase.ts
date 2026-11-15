import type { Verdict } from "@/components/capture/backend";

export type VerdictPhase =
  | { name: "reviewing" }
  | { name: "verdict"; verdict: Verdict }
  | { name: "error"; message: string };

export type PhaseEvent =
  | { type: "submit" }
  | { type: "verdict"; verdict: Verdict }
  | { type: "failure"; message: string };

export const initialPhase: VerdictPhase = { name: "reviewing" };

/** A result only lands while a submission is in flight, so a late reply cannot overwrite a newer phase. */
export function nextPhase(phase: VerdictPhase, event: PhaseEvent): VerdictPhase {
  switch (event.type) {
    case "submit":
      return initialPhase;
    case "verdict":
      return phase.name === "reviewing" ? { name: "verdict", verdict: event.verdict } : phase;
    case "failure":
      return phase.name === "reviewing" ? { name: "error", message: event.message } : phase;
  }
}
