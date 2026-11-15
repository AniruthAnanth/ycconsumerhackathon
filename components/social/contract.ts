/**
 * The slice of API.md that the social screens call, as typed function references.
 *
 * Backend modules land from several threads in no fixed order. Binding to the
 * documented names here lets every social screen typecheck against the agreed
 * contract rather than against whatever happens to be on main, and keeps the
 * shapes a screen renders readable in one place. Names and shapes mirror API.md
 * exactly; change them there first.
 */
import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

type NoArgs = Record<string, never>;

const query = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"query", Args, Result>(name);
const mutation = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"mutation", Args, Result>(name);
const action = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"action", Args, Result>(name);

export type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";

export type Place = { name: string; lat: number; lng: number };

export type TaskRow = {
  taskId: Id<"tasks">;
  slot: Slot;
  title: string;
  points: number;
  proofType: "photo" | "photo_location" | "canvas";
  place?: Place;
  status: "open" | "verified" | "held" | "failed";
  source: "draft" | "flex" | "drop" | "group";
  /** Points earned so far; null until a proof is verified. */
  score: number | null;
  verifiedAt?: number;
  thumbUrl?: string;
  dueLabel: string;
  upNext: boolean;
};

export type Me = {
  _id: Id<"users">;
  name?: string;
  phone?: string;
  onboarded: boolean;
  /** Set while Switch Player (demo controls) has this device playing as someone else. */
  actingAs?: { _id: Id<"users">; name: string };
  leagues: { _id: Id<"leagues">; name: string; stakeUsd: number; paid: boolean }[];
};

export type MatchupSide = {
  userId: Id<"users">;
  name: string;
  total: number;
  /** 0 to 1; the two sides sum to 1. */
  winProbability: number;
  /** The server's count of cleared lineup slots (0 to 5), group sessions included. */
  slotsCleared: number;
};

export type Matchup = {
  me: MatchupSide;
  opponent: MatchupSide;
  rows: { slot: Slot; mine?: TaskRow; theirs?: TaskRow }[];
};

export type FeedReaction = { emoji: string; count: number; mine: boolean };

export type FeedChallenge = {
  challengeId: Id<"challenges">;
  status: "open" | "upheld" | "overturned";
  legit: number;
  notLegit: number;
  /** true = I voted Legit, false = Not Legit, absent = I have not voted. */
  myVote?: boolean;
  /** Whether I may vote: false for the proof's owner and the challenger, and once the vote has settled. */
  canVote: boolean;
  closesAt: number;
};

export type FeedItem = {
  proofId: Id<"proofs">;
  kind: "proof" | "drop" | "group";
  user: { _id: Id<"users">; name: string; avatarUrl?: string };
  taskTitle: string;
  slot: Slot;
  points: number;
  /** The referee's one-line justification. Always shown. */
  reason: string;
  caption: string;
  mediaUrl?: string;
  mediaType: "photo" | "video" | "canvas";
  createdAt: number;
  /** Confidence between 0.6 and 0.75: passed, but worth a second look. */
  closeCall: boolean;
  reactions: FeedReaction[];
  challenge?: FeedChallenge;
};

export type Profile = {
  name: string;
  avatarUrl?: string;
  totalPoints: number;
  tasksCompleted: number;
  /** 0 to 1. */
  completionRate: number;
  /** null for a player with no verified proofs yet. */
  bestSlot: Slot | null;
  currentStreak: number;
  longestStreak: number;
  /** Highest single-week points total. */
  bestWeek: number;
  fastestQuickTimeSec?: number;
};

export type WrappedCard = {
  kind: "champion" | "best_proof" | "comeback" | "fastest" | "your_week";
  title: string;
  subtitle: string;
  stat: string;
  mediaUrl?: string;
  /** Absent means photo. */
  mediaType?: "photo" | "video";
};

export type CanvasAssignment = {
  courseId: string;
  assignmentId: string;
  courseName: string;
  title: string;
  dueAt?: number;
};

export type Drop = {
  dropId: Id<"drops">;
  kind: "quicktime" | "group";
  title: string;
  slot: Slot;
  points: number;
  gesture?: string;
  place?: Place;
  opensAt: number;
  closesAt: number;
  /**
   * The caller's task for this drop, present only while they can submit a proof against it. For a
   * group session that is while check-in is open: 30 minutes before the start until 2 hours after.
   */
  taskId?: Id<"tasks">;
  attendees?: { userId: Id<"users">; name: string; checkedIn: boolean }[];
};

export const socialApi = {
  users: {
    me: query<NoArgs, Me | null>("users:me"),
  },
  standings: {
    matchup: query<{ leagueId: Id<"leagues"> }, Matchup | null>("standings:matchup"),
  },
  feed: {
    list: query<{ leagueId: Id<"leagues"> }, FeedItem[]>("feed:list"),
    react: mutation<{ proofId: Id<"proofs">; emoji: string }, null>("feed:react"),
  },
  challenges: {
    open: mutation<{ proofId: Id<"proofs">; leagueId: Id<"leagues"> }, Id<"challenges">>("challenges:open"),
    vote: mutation<{ challengeId: Id<"challenges">; legit: boolean }, null>("challenges:vote"),
  },
  profile: {
    get: query<{ userId: Id<"users"> }, Profile>("profile:get"),
  },
  wrapped: {
    get: query<{ leagueId: Id<"leagues">; weekNumber?: number }, { cards: WrappedCard[] }>("wrapped:get"),
  },
  canvas: {
    connect: mutation<{ baseUrl: string; token: string }, null>("canvas:connect"),
    connection: query<NoArgs, { connected: boolean; baseUrl?: string }>("canvas:connection"),
    listAssignments: action<NoArgs, CanvasAssignment[]>("canvas:listAssignments"),
    /** Adds an upcoming assignment to the week as a flex task (limit of 3 a week) that canvas.verify can check. */
    addTask: mutation<{ courseId: string; assignmentId: string; title: string }, Id<"tasks">>("canvas:addTask"),
  },
  drops: {
    active: query<{ leagueId: Id<"leagues"> }, Drop[]>("drops:active"),
    createGroupSession: mutation<
      { leagueId: Id<"leagues">; title: string; place: Place; startsAt: number },
      Id<"drops">
    >("drops:createGroupSession"),
    rsvp: mutation<{ dropId: Id<"drops"> }, null>("drops:rsvp"),
  },
  keiki: {
    chat: action<{ leagueId: Id<"leagues">; text: string }, { reply: string }>("keiki:chat"),
  },
};
