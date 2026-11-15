import type { ProofType, Slot } from "@/lib/slots";

export type Place = { name: string; lat: number; lng: number };

export type DraftTask = {
  slot: Slot;
  title: string;
  points: number;
  proofType: ProofType;
  place?: Place;
};

export type DraftResult = { transcript: string; tasks: DraftTask[] };
