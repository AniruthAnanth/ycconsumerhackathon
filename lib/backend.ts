/**
 * The slice of the backend contract (API.md) that the shell screens call, as
 * typed function references.
 *
 * Backend modules land from several threads in no fixed order. Binding to the
 * agreed names here lets Roster, League, onboarding and join typecheck against
 * the contract rather than against whatever happens to be on main, and keeps
 * every shape a shell screen renders readable in one place. Names and shapes
 * mirror API.md exactly; change them there first.
 *
 * Nothing here is checked against convex/ by itself. backend.contract.ts fails
 * the typecheck when a binding stops matching the real function, and
 * backend.test.ts when its name does.
 */
import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";

import type { ProofType, Slot } from "./slots";

export type NoArgs = Record<string, never>;

export const query = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"query", Args, Result>(name);
export const mutation = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"mutation", Args, Result>(name);
export const action = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"action", Args, Result>(name);

export type Place = { name: string; lat: number; lng: number };

/** A league as the signed-in player sees it in the header's league switcher. */
export type MyLeague = { _id: Id<"leagues">; name: string; stakeUsd: number; paid: boolean };

export type Me = {
  _id: Id<"users">;
  name?: string;
  phone?: string;
  /** False until the name and phone screen has been completed. */
  onboarded: boolean;
  /** Set while Switch Player (demo controls) has this device playing as a seeded player. */
  actingAs?: { _id: Id<"users">; name: string };
  leagues: MyLeague[];
};

export type League = {
  _id: Id<"leagues">;
  name: string;
  inviteCode: string;
  stakeUsd: number;
  memberCount: number;
  /** The league's current week. startsAt is that week's Monday 00:00 in Los Angeles. */
  week: { _id: Id<"weeks">; number: number; startsAt: number; endsAt: number; status: "open" | "settled" };
};

/** One task in a roster. */
export type Task = {
  taskId: Id<"tasks">;
  slot: Slot;
  title: string;
  points: number;
  proofType: ProofType;
  place?: Place;
  status: "open" | "verified" | "held" | "failed";
  source: "draft" | "flex" | "drop" | "group";
  /** Points earned; null until a proof is verified. */
  score: number | null;
  verifiedAt?: number;
  thumbUrl?: string;
  dueLabel: string;
  /** True on the one task the player should do next. */
  upNext: boolean;
};

export type Roster = {
  locked: boolean;
  weekStart: number;
  /** The rows' scores plus bonusPoints: the same number the League and Matchup tabs show. */
  total: number;
  bonusPoints: number;
  /** A short name for each part of bonusPoints, such as "2 slots cleared" or "Streak". */
  bonusLabels: string[];
  rows: Task[];
};

export type Standing = {
  rank: number;
  userId: Id<"users">;
  name: string;
  avatarUrl?: string;
  /** Of the five roster slots. */
  slotsCleared: number;
  points: number;
  streak: number;
  paid: boolean;
};

export type Payout = {
  userId: Id<"users">;
  name: string;
  kind: "refund" | "winnings";
  amountUsd: number;
  /** Whop's id for the refund or transfer; present only once Whop has accepted the money movement. */
  whopId?: string;
};

export type Pot = {
  stakeUsd: number;
  potUsd: number;
  paid: { userId: Id<"users">; name: string }[];
  unpaid: { userId: Id<"users">; name: string }[];
  settlesAt: number;
  /** Present once the week has settled. */
  payouts?: Payout[];
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
  taskId?: Id<"tasks">;
  attendees?: { userId: Id<"users">; name: string; checkedIn: boolean }[];
};

export type ContactMatch = {
  /** Contacts already on Lineup, now members of the league. */
  added: { userId: Id<"users">; name: string }[];
  /** E.164 numbers with no Lineup account: these get the invite text. */
  notOnLineup: string[];
};

export const backend = {
  users: {
    me: query<NoArgs, Me | null>("users:me"),
    createUser: mutation<{ name: string; phone: string }, Id<"users">>("users:createUser"),
    matchContacts: mutation<{ leagueId: Id<"leagues">; phones: string[] }, ContactMatch>("users:matchContacts"),
  },
  leagues: {
    joinByCode: mutation<{ inviteCode: string }, { leagueId: Id<"leagues"> }>("leagues:joinByCode"),
    quickMatch: mutation<{ stakeUsd: 0 | 5 | 20 }, { leagueId: Id<"leagues"> }>("leagues:quickMatch"),
    get: query<{ leagueId: Id<"leagues"> }, League>("leagues:get"),
  },
  standings: {
    table: query<{ leagueId: Id<"leagues"> }, Standing[]>("standings:table"),
    pot: query<{ leagueId: Id<"leagues"> }, Pot>("standings:pot"),
  },
  lineup: {
    roster: query<{ leagueId?: Id<"leagues">; userId?: Id<"users">; weekStart?: number }, Roster>("lineup:roster"),
    addFlexTask: mutation<{ title: string }, Id<"tasks">>("lineup:addFlexTask"),
  },
  drops: {
    active: query<{ leagueId: Id<"leagues"> }, Drop[]>("drops:active"),
  },
  whop: {
    createCheckout: action<{ leagueId: Id<"leagues"> }, { purchaseUrl: string }>("whop:createCheckout"),
  },
} as const;
