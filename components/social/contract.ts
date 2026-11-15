/**
 * The slice of API.md that the social screens call, as typed function references.
 *
 * Names and shapes mirror API.md by hand; change them there first.
 */
import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";
import { backend, type Place, type Task as TaskRow } from "@/lib/backend";
import type { Slot } from "@/lib/slots";

export type { Slot } from "@/lib/slots";
export type { Place, Me, Drop, Task as TaskRow } from "@/lib/backend";

type NoArgs = Record<string, never>;

const query = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"query", Args, Result>(name);
const mutation = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"mutation", Args, Result>(name);
const action = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"action", Args, Result>(name);

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
  /** true when the referee was unsure (under 0.6 confidence) and sent the proof to the league itself. */
  byReferee?: boolean;
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

export type TaskVeto = {
  taskId: Id<"tasks">;
  ownerId: Id<"users">;
  ownerName: string;
  title: string;
  slot: Slot;
  points: number;
  /** Vetoes cast so far. */
  votes: number;
  /** Vetoes that strike it. */
  needed: number;
  /** I have vetoed it. */
  mine: boolean;
  /** false for the owner, after closesAt, and once struck. */
  canVote: boolean;
  /** The league struck it; the owner must swap it. */
  struck: boolean;
  /** ms; voting ends. */
  closesAt: number;
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

export const socialApi = {
  users: {
    me: backend.users.me,
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
  vetoes: {
    /** The current week's vetoable or struck tasks in the league. */
    board: query<{ leagueId: Id<"leagues"> }, TaskVeto[]>("vetoes:board"),
    /** Toggles my veto on or off while the vote is open. */
    cast: mutation<{ taskId: Id<"tasks">; leagueId: Id<"leagues"> }, null>("vetoes:cast"),
    /** The owner replaces a struck task with a new title. */
    swap: mutation<{ taskId: Id<"tasks">; title: string }, null>("vetoes:swap"),
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
    active: backend.drops.active,
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
