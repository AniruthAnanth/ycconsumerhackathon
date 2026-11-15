import { describe, expect, it } from "vitest";

import { buildSeason } from "../seasons";
import {
  bracketFor,
  resolveSettings,
  scheduleFor,
  seasonOf,
  seasonTable,
  withoutStandIns,
  withStandIns,
  type Bracket,
  type LeagueFormat,
  type Pairing,
  type Result,
} from "./schedule";

// ---------------------------------------------------------------------------
// Simulator
//
// Plays whole leagues the way leagues.ts does: each week asks scheduleFor for
// the pairings given every earlier (finished) result, then scores them. Scores
// are drawn from a small range so ties happen often, and from a seeded
// generator so a failing case can be replayed.

const FORMATS: LeagueFormat[] = ["round_robin", "double_round_robin", "bracket"];
const SIZES = Array.from({ length: 13 }, (_, i) => i);
const SEASON_LENGTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** mulberry32: a few lines, and good enough to scatter scores. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Step = {
  week: number;
  pairings: Pairing<string>[];
  /** Every result of the weeks before this one. */
  before: Result<string>[];
  /** The week's own results, scored. */
  played: Result<string>[];
};

type Simulation = {
  label: string;
  format: LeagueFormat;
  members: string[];
  seasonWeeks: number;
  steps: Step[];
};

function simulate(format: LeagueFormat, size: number, seasonWeeks: number): Simulation {
  const random = seededRandom((FORMATS.indexOf(format) * 100 + size) * 100 + seasonWeeks);
  const members = Array.from({ length: size }, (_, i) => "p" + String(i).padStart(2, "0"));
  const steps: Step[] = [];
  let results: Result<string>[] = [];

  // A full season, then two weeks of the next one.
  for (let week = 1; week <= seasonWeeks + 2; week++) {
    const pairings = scheduleFor(format, members, week, results, seasonWeeks);
    const played = pairings.map((pairing) => ({
      ...pairing,
      week,
      scoreA: Math.floor(random() * 5) * 10,
      scoreB: Math.floor(random() * 5) * 10,
    }));
    steps.push({ week, pairings, before: results, played });
    results = [...results, ...played];
  }
  return {
    label: format + ", " + size + " members, " + seasonWeeks + "-week season",
    format,
    members,
    seasonWeeks,
    steps,
  };
}

const simulations: Simulation[] = FORMATS.flatMap((format) =>
  SIZES.flatMap((size) =>
    SEASON_LENGTHS.map((seasonWeeks) => simulate(format, size, seasonWeeks)),
  ),
);

function pairKey(pairing: Pairing<string>): string {
  return [pairing.a, pairing.b].sort().join("-");
}

/** Weeks until a round robin of this size starts repeating. */
function cycleLength(size: number): number {
  return size % 2 === 0 ? size - 1 : size;
}

/** Fewest knockout rounds that fit size players. */
function roundsToFit(size: number): number {
  let rounds = 0;
  while (2 ** rounds < size) rounds++;
  return rounds;
}

/** The steps from start onward that fit in one cycle without leaving the season. */
function cycleFrom(simulation: Simulation, start: Step): Step[] {
  const cycle = cycleLength(simulation.members.length);
  const season = seasonOf(start.week, simulation.seasonWeeks);
  const window = simulation.steps.filter(
    (step) => step.week >= start.week && step.week < start.week + cycle && step.week <= season.lastWeek,
  );
  return window.length === cycle ? window : [];
}

/** The bracket as of the start and the end of every week that has one. */
function bracketsOf(simulation: Simulation): { week: number; bracket: Bracket<string> }[] {
  return simulation.steps.flatMap((step) =>
    [step.before, [...step.before, ...step.played]].flatMap((results) => {
      const bracket = bracketFor(simulation.members, step.week, results, simulation.seasonWeeks);
      return bracket === null ? [] : [{ week: step.week, bracket }];
    }),
  );
}

// ---------------------------------------------------------------------------

describe("every week's pairings", () => {
  it("never throw, and pair each member at most once, with someone else", () => {
    for (const { label, members, steps } of simulations) {
      for (const { week, pairings } of steps) {
        const where = label + ", week " + week;
        const seen = new Set<string>();
        for (const { a, b } of pairings) {
          expect(a, where).not.toBe(b);
          expect(members, where).toContain(a);
          expect(members, where).toContain(b);
          expect(seen.has(a) || seen.has(b), where + ": " + a + " or " + b + " plays twice").toBe(false);
          seen.add(a);
          seen.add(b);
        }
      }
    }
  });
});

describe("round robin", () => {
  const sims = simulations.filter((s) => s.format === "round_robin");

  it("has every pair meet once in any size-1 consecutive weeks of a season", () => {
    for (const simulation of sims) {
      const { label, members, steps } = simulation;
      if (members.length < 2 || members.length % 2 === 1) continue;
      const everyPair = members.flatMap((x, i) => members.slice(i + 1).map((y) => x + "-" + y));
      for (const start of steps) {
        const window = cycleFrom(simulation, start);
        if (window.length === 0) continue;
        const meetings = window.flatMap((step) => step.pairings.map(pairKey)).sort();
        expect(meetings, label + ", from week " + start.week).toEqual(everyPair);
      }
    }
  });

  it("gives each member one bye per cycle when the league is odd", () => {
    for (const simulation of sims) {
      const { label, members, steps } = simulation;
      if (members.length % 2 === 0) continue;
      for (const start of steps) {
        const window = cycleFrom(simulation, start);
        if (window.length === 0) continue;
        for (const member of members) {
          const byes = window.filter(
            (step) => !step.pairings.some((p) => p.a === member || p.b === member),
          ).length;
          expect(byes, label + ", " + member + " from week " + start.week).toBe(1);
        }
      }
    }
  });
});

describe("double round robin", () => {
  it("has every pair meet twice over two cycles, once on each side", () => {
    for (const size of SIZES.filter((n) => n >= 2)) {
      // The rotation restarts every season, so the season has to hold both cycles.
      const seasonWeeks = 2 * cycleLength(size);
      const members = Array.from({ length: size }, (_, i) => "p" + i);
      const meetings = new Map<string, Pairing<string>[]>();
      for (let week = 1; week <= seasonWeeks; week++) {
        for (const pairing of scheduleFor("double_round_robin", members, week, [], seasonWeeks)) {
          const key = pairKey(pairing);
          meetings.set(key, [...(meetings.get(key) ?? []), pairing]);
        }
      }
      const where = size + " members";
      expect(meetings.size, where).toBe((size * (size - 1)) / 2);
      for (const [key, [first, second, ...rest]] of meetings) {
        expect(rest, where + ", " + key).toEqual([]);
        expect(second, where + ", " + key).toEqual({ a: first.b, b: first.a });
      }
    }
  });
});

describe("bracket", () => {
  const sims = simulations.filter((s) => s.format === "bracket");

  it("exists from two members, with one round per week ending in the season's last week", () => {
    for (const { label, members, seasonWeeks, steps } of sims) {
      for (const { week, before } of steps) {
        const bracket = bracketFor(members, week, before, seasonWeeks);
        const where = label + ", week " + week;
        if (members.length < 2) {
          expect(bracket, where).toBeNull();
          continue;
        }
        const rounds = Math.min(roundsToFit(members.length), seasonWeeks);
        expect(bracket!.rounds, where).toHaveLength(rounds);
        const lastWeek = seasonOf(week, seasonWeeks).lastWeek;
        bracket!.rounds.forEach((round, i) => {
          expect(round.week, where).toBe(lastWeek - rounds + 1 + i);
        });
      }
    }
  });

  it("advances the higher score of a match's two sides, the better seed when tied", () => {
    for (const simulation of sims) {
      for (const { week, bracket } of bracketsOf(simulation)) {
        for (const round of bracket.rounds) {
          for (const match of round.matches) {
            if (match.winner === null || match.bye) continue;
            const where = simulation.label + ", week " + week + ", " + round.name;
            expect([match.a, match.b], where).toContain(match.winner);
            if (match.scoreA === null || match.scoreB === null) continue;
            if (match.scoreA === match.scoreB) {
              const better = match.seedA! < match.seedB! ? match.a : match.b;
              expect(match.winner, where + ": tie").toBe(better);
            } else {
              const higher = match.scoreA > match.scoreB ? match.a : match.b;
              expect(match.winner, where + ": higher score").toBe(higher);
            }
          }
        }
      }
    }
  });

  it("never shows a player who lost in a later round", () => {
    for (const simulation of sims) {
      for (const { week, bracket } of bracketsOf(simulation)) {
        bracket.rounds.forEach((round, index) => {
          const later = new Set(
            bracket.rounds.slice(index + 1).flatMap((r) => r.matches.flatMap((m) => [m.a, m.b])),
          );
          for (const match of round.matches) {
            if (match.winner === null || match.a === null || match.b === null) continue;
            const loser = match.winner === match.a ? match.b : match.a;
            expect(
              later.has(loser),
              simulation.label + ", week " + week + ": " + loser + " lost in the " + round.name,
            ).toBe(false);
          }
        });
      }
    }
  });

  it("keeps seeds 1 and 2 apart until the final when the field is full", () => {
    for (const simulation of sims) {
      const size = simulation.members.length;
      const fullField = size >= 2 && 2 ** roundsToFit(size) === size && roundsToFit(size) <= simulation.seasonWeeks;
      if (!fullField) continue;
      for (const { week, bracket } of bracketsOf(simulation)) {
        for (const round of bracket.rounds.slice(0, -1)) {
          for (const match of round.matches) {
            expect(
              [match.seedA, match.seedB].sort(),
              simulation.label + ", week " + week + ", " + round.name,
            ).not.toEqual([1, 2]);
          }
        }
      }
    }
  });

  it("crowns the winner of the final once it is played", () => {
    for (const { label, members, seasonWeeks, steps } of sims) {
      if (members.length < 2) continue;
      for (const { week, before, played } of steps) {
        const bracket = bracketFor(members, week, [...before, ...played], seasonWeeks)!;
        const final = bracket.rounds[bracket.rounds.length - 1];
        if (week !== final.week) continue;
        const [match] = final.matches;
        expect(match.scoreA, label + ": the final was not played").not.toBeNull();
        expect(bracket.champion, label).not.toBeNull();
        expect(bracket.champion, label).toBe(match.winner);
        expect([match.a, match.b], label).toContain(bracket.champion);
      }
    }
  });

  it("schedules every ready match of a playoff week and keeps live players out of the rest", () => {
    for (const { label, members, seasonWeeks, steps } of sims) {
      for (const { week, before, pairings } of steps) {
        const round = bracketFor(members, week, before, seasonWeeks)?.rounds.find((r) => r.week === week);
        if (round === undefined) continue;
        const where = label + ", week " + week;
        const ready = round.matches.filter((m) => m.a !== null && m.b !== null);
        const readyKeys = new Set(ready.map((m) => pairKey({ a: m.a!, b: m.b! })));
        const scheduled = new Set(pairings.map(pairKey));
        for (const key of readyKeys) {
          expect(scheduled.has(key), where + ": " + key + " is missing").toBe(true);
        }
        const alive = new Set(round.matches.flatMap((m) => [m.a, m.b]));
        for (const pairing of pairings.filter((p) => !readyKeys.has(pairKey(p)))) {
          expect(
            alive.has(pairing.a) || alive.has(pairing.b),
            where + ": " + pairKey(pairing) + " pairs a player still in the bracket",
          ).toBe(false);
        }
      }
    }
  });
});

describe("seasonTable", () => {
  const states = simulations.flatMap(({ label, members, steps }) =>
    steps.map(({ week, before, played }) => ({
      label: label + ", after week " + (week - 1),
      members,
      before,
      played,
    })),
  );

  it("counts every finished result of a member as one win, loss or tie", () => {
    for (const { label, members, before } of states) {
      const table = seasonTable(members, before);
      for (const row of table) {
        const games = before.filter((r) => r.a === row.id || r.b === row.id).length;
        expect(row.wins + row.losses + row.ties, label + ", " + row.id).toBe(games);
      }
      const total = (pick: (row: (typeof table)[number]) => number) =>
        table.reduce((sum, row) => sum + pick(row), 0);
      expect(total((row) => row.wins), label).toBe(total((row) => row.losses));
    }
  });

  it("orders rows by wins, then points for", () => {
    for (const { label, members, before } of states) {
      const table = seasonTable(members, before);
      for (let i = 1; i < table.length; i++) {
        const [better, worse] = [table[i - 1], table[i]];
        const inOrder =
          better.wins > worse.wins ||
          (better.wins === worse.wins && better.pointsFor >= worse.pointsFor);
        expect(inOrder, label + ": " + better.id + " before " + worse.id).toBe(true);
      }
    }
  });

  it("ignores live results", () => {
    for (const { label, members, before, played } of states) {
      const live = played.map((result) => ({ ...result, live: true }));
      expect(seasonTable(members, [...before, ...live]), label).toEqual(seasonTable(members, before));
    }
  });
});

describe("stand-ins", () => {
  it("come out again, and leave nobody out of a non-empty week", () => {
    for (const { label, members, steps } of simulations) {
      for (const { week, pairings } of steps) {
        const where = label + ", week " + week;
        const stored = withStandIns(pairings, members);
        expect(withoutStandIns(stored), where).toEqual(pairings);
        if (pairings.length === 0) continue;
        const appearing = new Set(stored.flatMap((p) => [p.a, p.b]));
        for (const member of members) {
          expect(appearing.has(member), where + ": " + member + " is missing").toBe(true);
        }
      }
    }
  });
});

describe("buildSeason", () => {
  it("shows a whole, consistent season at every point of a simulated one", () => {
    for (const { label, format, members, seasonWeeks, steps } of simulations) {
      const settings = resolveSettings({ format, seasonWeeks });
      for (const { week, before, played } of steps) {
        for (const newestIsLive of [true, false]) {
          const where = label + ", week " + week + (newestIsLive ? " live" : " finished");
          const view = buildSeason({
            settings,
            members: members.map((id) => ({ id, joinedAt: 0 })),
            openedWeeks: Array.from({ length: week }, (_, i) => ({
              number: i + 1,
              endsAt: (i + 1) * WEEK_MS,
              live: i + 1 === week && newestIsLive,
            })),
            results: [...before, ...played.map((r) => (newestIsLive ? { ...r, live: true } : r))],
          });

          expect(view.weeks.map((w) => w.number), where).toEqual(
            Array.from({ length: seasonWeeks }, (_, i) => i + 1),
          );
          expect(view.weeks.filter((w) => w.status === "live").length, where).toBeLessThanOrEqual(1);
          for (const w of view.weeks) {
            const ids = [...w.matchups.flatMap((m) => [m.a, m.b]), ...w.byes];
            expect(new Set(ids).size, where + ", week " + w.number).toBe(ids.length);
          }
          expect(view.table.map((row) => row.id).sort(), where).toEqual([...members].sort());
        }
      }
    }
  });
});
