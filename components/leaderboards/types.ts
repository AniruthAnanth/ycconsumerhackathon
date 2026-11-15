import type { Id } from "@/convex/_generated/dataModel";

// Mirrors the return types of api.leaderboards.board and api.leaderboards.projection.
// convex/leaderboards.ts is the source of truth; change this file when it changes.

export type BoardKey =
  | "week"
  | "season"
  | "allTime"
  | "body"
  | "mind"
  | "recharge"
  | "chores"
  | "people"
  | "streak"
  | "highlights"
  | "quickTime"
  | "headToHead"
  | "money"
  | "recruiters"
  | "global"
  | "globalAllTime";

export type BoardRow = {
  /** 1-based; equal values share a rank. */
  rank: number;
  userId: Id<"users">;
  name: string;
  avatarUrl?: string;
  value: number;
  /** Formatted by the server: "245", "$12.40", "3-1", "42s", "9/10". */
  valueLabel: string;
  /** One grey line of context: "4/5 slots", "Leg day at the gym". */
  detail?: string;
  /** Places gained since yesterday: 2 is up two, -1 is down one. */
  movement: number;
  /** "15 behind Maya", or "15 ahead of Sam" for the leader. */
  gapLabel?: string;
  isMe: boolean;
  /** The caller's closest rival on this board. */
  isRival: boolean;
};

export type Board = {
  board: BoardKey;
  title: string;
  valueHeader: string;
  rows: BoardRow[];
  rival?: { userId: Id<"users">; name: string; label: string };
};

export type Projection = {
  /** "Projected: +$12.40". */
  label: string;
  /** False when the player is unpaid and cannot win the pot. */
  eligible: boolean;
  stakeUsd: number;
  ifEndedNowUsd: number;
  expectedUsd: number;
  lowUsd: number;
  highUsd: number;
  /** 0 to 1. */
  finishProbability: number;
};
