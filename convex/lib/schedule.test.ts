import { describe, expect, it } from "vitest";

import {
  bracketFor,
  DEFAULT_SETTINGS,
  isFinalWeek,
  resolveSettings,
  scheduleFor,
  seasonOf,
  seasonTable,
  withoutStandIns,
  withStandIns,
  type Pairing,
  type Result,
} from "./schedule";
import { pairsAfterJoin } from "./week";

const SIX = ["a", "b", "c", "d", "e", "f"];

/** "a-b" with the two ids in alphabetical order, so sides don't matter. */
function pairKey(pairing: Pairing<string>): string {
  return [pairing.a, pairing.b].sort().join("-");
}

function allPairs(ids: string[]): string[] {
  return ids.flatMap((x, i) => ids.slice(i + 1).map((y) => x + "-" + y)).sort();
}

/**
 * Plays weeks from..to with the higher "strength" winning every match, which
 * makes the table a b c d e f for SIX.
 */
function play(
  format: "round_robin" | "double_round_robin" | "bracket",
  ids: string[],
  from: number,
  to: number,
  earlier: Result<string>[] = [],
  seasonWeeks = 8,
): Result<string>[] {
  const strength = (id: string) => 100 - id.charCodeAt(0);
  const results = [...earlier];
  for (let week = from; week <= to; week++) {
    for (const pairing of scheduleFor(format, ids, week, results, seasonWeeks)) {
      results.push({
        ...pairing,
        week,
        scoreA: strength(pairing.a),
        scoreB: strength(pairing.b),
      });
    }
  }
  return results;
}

describe("resolveSettings", () => {
  it("keeps the original behaviour when a league stores no settings", () => {
    expect(resolveSettings({})).toEqual({
      payout: "weekly",
      seasonWeeks: 8,
      format: "round_robin",
    });
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps what the creator chose and repairs an impossible season length", () => {
    expect(
      resolveSettings({ payout: "season", seasonWeeks: 12, format: "bracket" }),
    ).toEqual({ payout: "season", seasonWeeks: 12, format: "bracket" });
    expect(resolveSettings({ seasonWeeks: 0 }).seasonWeeks).toBe(8);
    expect(resolveSettings({ seasonWeeks: 2.5 }).seasonWeeks).toBe(8);
    expect(resolveSettings({ seasonWeeks: 500 }).seasonWeeks).toBe(8);
  });
});

describe("seasonOf", () => {
  it("rolls a league into a new season after seasonWeeks", () => {
    expect(seasonOf(1, 8)).toEqual({ number: 1, firstWeek: 1, lastWeek: 8 });
    expect(seasonOf(8, 8)).toEqual({ number: 1, firstWeek: 1, lastWeek: 8 });
    expect(seasonOf(9, 8)).toEqual({ number: 2, firstWeek: 9, lastWeek: 16 });
  });

  it("marks the week a season payout settles", () => {
    expect(isFinalWeek(7, 8)).toBe(false);
    expect(isFinalWeek(8, 8)).toBe(true);
    expect(isFinalWeek(16, 8)).toBe(true);
  });
});

describe("round robin", () => {
  it("has everyone meet exactly once in a cycle and play once a week", () => {
    const met: string[] = [];
    for (let week = 1; week <= 5; week++) {
      const pairings = scheduleFor("round_robin", SIX, week, []);
      expect(pairings.flatMap((p) => [p.a, p.b]).sort()).toEqual(SIX);
      met.push(...pairings.map(pairKey));
    }
    expect(met.sort()).toEqual(allPairs(SIX));
  });

  it("gives an odd league one bye a week, shared evenly", () => {
    const five = SIX.slice(0, 5);
    const byes: string[] = [];
    const met: string[] = [];
    for (let week = 1; week <= 5; week++) {
      const pairings = scheduleFor("round_robin", five, week, []);
      expect(pairings).toHaveLength(2);
      const playing = pairings.flatMap((p) => [p.a, p.b]);
      byes.push(...five.filter((id) => !playing.includes(id)));
      met.push(...pairings.map(pairKey));
    }
    expect(byes.sort()).toEqual(five);
    expect(met.sort()).toEqual(allPairs(five));
  });

  it("starts the rotation again when the season outlasts one cycle", () => {
    expect(scheduleFor("round_robin", SIX, 6, [])).toEqual(
      scheduleFor("round_robin", SIX, 1, []),
    );
  });

  it("seats members by the order given, which callers keep as join order", () => {
    // Week 1 pairs neighbours; each week everyone but the first moves up one.
    expect(scheduleFor("round_robin", SIX, 1, [])).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
      { a: "e", b: "f" },
    ]);
    expect(scheduleFor("round_robin", SIX, 2, [])).toEqual([
      { a: "a", b: "c" },
      { a: "e", b: "b" },
      { a: "f", b: "d" },
    ]);
    expect(scheduleFor("round_robin", ["a", "b", "a"], 1, [])).toEqual([
      { a: "a", b: "b" },
    ]);
  });

  it("pairs nobody in a league of one, and the only two in a league of two", () => {
    expect(scheduleFor("round_robin", [], 1, [])).toEqual([]);
    expect(scheduleFor("round_robin", ["a"], 1, [])).toEqual([]);
    expect(scheduleFor("round_robin", ["b", "a"], 3, [])).toEqual([
      { a: "b", b: "a" },
    ]);
  });

  it("restarts the schedule in the league's next season", () => {
    expect(scheduleFor("round_robin", SIX, 9, [], 8)).toEqual(
      scheduleFor("round_robin", SIX, 1, [], 8),
    );
  });
});

describe("double round robin", () => {
  it("plays the return leg with the sides swapped", () => {
    for (let week = 1; week <= 5; week++) {
      const first = scheduleFor("double_round_robin", SIX, week, [], 10);
      const second = scheduleFor("double_round_robin", SIX, week + 5, [], 10);
      expect(second).toEqual(first.map(({ a, b }) => ({ a: b, b: a })));
    }
  });

  it("has everyone meet exactly twice over two cycles", () => {
    const met: string[] = [];
    for (let week = 1; week <= 10; week++) {
      met.push(
        ...scheduleFor("double_round_robin", SIX, week, [], 10).map(pairKey),
      );
    }
    expect(met.sort()).toEqual([...allPairs(SIX), ...allPairs(SIX)].sort());
  });

  it("shares its first leg with the single round robin", () => {
    for (let week = 1; week <= 5; week++) {
      expect(scheduleFor("double_round_robin", SIX, week, [])).toEqual(
        scheduleFor("round_robin", SIX, week, []),
      );
    }
  });
});

describe("seasonTable", () => {
  it("counts wins, losses, ties and points, best first", () => {
    const table = seasonTable(
      ["a", "b", "c"],
      [
        { week: 1, a: "a", b: "b", scoreA: 120, scoreB: 80 },
        { week: 2, a: "c", b: "a", scoreA: 90, scoreB: 90 },
        { week: 3, a: "b", b: "c", scoreA: 70, scoreB: 100 },
      ],
    );
    expect(table).toEqual([
      { id: "a", wins: 1, losses: 0, ties: 1, pointsFor: 210, pointsAgainst: 170 },
      { id: "c", wins: 1, losses: 0, ties: 1, pointsFor: 190, pointsAgainst: 160 },
      { id: "b", wins: 0, losses: 2, ties: 0, pointsFor: 150, pointsAgainst: 220 },
    ]);
  });

  it("leaves out a week that is still being played", () => {
    const table = seasonTable(
      ["a", "b"],
      [{ week: 1, a: "a", b: "b", scoreA: 10, scoreB: 50, live: true }],
    );
    expect(table.map((row) => row.wins + row.losses + row.pointsFor)).toEqual([
      0, 0,
    ]);
  });

  it("ranks the earlier joiner first when wins and points are level", () => {
    const table = seasonTable(
      ["early", "late"],
      [{ week: 1, a: "late", b: "early", scoreA: 50, scoreB: 50 }],
    );
    expect(table.map((row) => row.id)).toEqual(["early", "late"]);
  });

  it("lists a member with no results and ignores one who has left", () => {
    const table = seasonTable(
      ["a", "b"],
      [{ week: 1, a: "a", b: "gone", scoreA: 40, scoreB: 10 }],
    );
    expect(table.map((row) => row.id)).toEqual(["a", "b"]);
    expect(table[0]).toMatchObject({ wins: 1, pointsFor: 40 });
  });
});

describe("a league that fills up during its first week", () => {
  /** The week leagues.addMember has stored once these members joined one by one. */
  function weekBuiltByJoining(members: string[]): [string, string][] {
    let pairs: [string, string][] = [];
    members.forEach((newcomer, joinedBefore) => {
      pairs = pairsAfterJoin(pairs, members.slice(0, joinedBefore), newcomer);
    });
    return pairs;
  }

  it("has played the schedule's first round, for every league size", () => {
    for (let size = 0; size <= 9; size++) {
      const members = Array.from({ length: size }, (_, i) => "m" + i);
      const firstRound = withStandIns(scheduleFor("round_robin", members, 1, []), members);
      expect(firstRound.map(({ a, b }) => [a, b])).toEqual(weekBuiltByJoining(members));
    }
  });

  it("meets nobody twice before everyone has met once", () => {
    for (let size = 2; size <= 9; size++) {
      const members = Array.from({ length: size }, (_, i) => "m" + i);
      const cycle = size % 2 === 0 ? size - 1 : size;
      const met = withoutStandIns(
        weekBuiltByJoining(members).map(([a, b]) => ({ a, b })),
      ).map(pairKey);
      for (let week = 2; week <= cycle; week++) {
        met.push(...scheduleFor("round_robin", members, week, [], cycle).map(pairKey));
      }
      expect(met.sort()).toEqual(allPairs(members));
    }
  });
});

describe("stand-ins", () => {
  it("gives the member with the week off a matchup against the first paired member, last", () => {
    const five = SIX.slice(0, 5);
    const pairings = scheduleFor("round_robin", five, 1, []);
    expect(pairings).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
    ]);
    expect(withStandIns(pairings, five)).toEqual([...pairings, { a: "e", b: "a" }]);
  });

  it("adds nothing when everyone plays or nobody does", () => {
    const pairings = scheduleFor("round_robin", SIX, 1, []);
    expect(withStandIns(pairings, SIX)).toEqual(pairings);
    expect(withStandIns([], ["a"])).toEqual([]);
  });

  it("is taken out again when a stored week is read back", () => {
    const five = SIX.slice(0, 5);
    for (let week = 1; week <= 5; week++) {
      const pairings = scheduleFor("round_robin", five, week, []);
      expect(withoutStandIns(withStandIns(pairings, five))).toEqual(pairings);
    }
  });

  it("covers every bye of a bracket round", () => {
    const regular = play("bracket", SIX, 1, 5);
    const stored = withStandIns(scheduleFor("bracket", SIX, 6, regular), SIX);
    expect(stored.slice(2)).toEqual([
      { a: "a", b: "d" },
      { a: "b", b: "d" },
    ]);
    expect(withoutStandIns(stored)).toHaveLength(2);
  });
});

describe("bracket", () => {
  it("plays a round robin until the bracket's first week", () => {
    for (let week = 1; week <= 5; week++) {
      expect(scheduleFor("bracket", SIX, week, [])).toEqual(
        scheduleFor("round_robin", SIX, week, []),
      );
    }
  });

  it("seeds six players by the table and gives the top two a bye", () => {
    const regular = play("bracket", SIX, 1, 5);
    const bracket = bracketFor(SIX, 6, regular);

    expect(bracket?.seeds).toEqual(SIX);
    expect(bracket?.firstWeek).toBe(6);
    expect(bracket?.projected).toBe(false);
    expect(bracket?.rounds.map((round) => [round.week, round.name])).toEqual([
      [6, "Quarterfinals"],
      [7, "Semifinals"],
      [8, "Final"],
    ]);
    expect(
      bracket?.rounds[0].matches.map((m) => [m.seedA, m.seedB, m.bye]),
    ).toEqual([
      [1, null, true],
      [4, 5, false],
      [2, null, true],
      [3, 6, false],
    ]);
    // Seeds 1 and 2 sit the first round out.
    expect(scheduleFor("bracket", SIX, 6, regular)).toEqual([
      { a: "d", b: "e" },
      { a: "c", b: "f" },
    ]);
  });

  it("advances winners a round a week and pairs the eliminated", () => {
    const throughQuarters = play("bracket", SIX, 1, 6);
    expect(scheduleFor("bracket", SIX, 7, throughQuarters)).toEqual([
      { a: "a", b: "d" },
      { a: "b", b: "c" },
      { a: "e", b: "f" }, // consolation: both lost in week 6
    ]);

    const throughSemis = play("bracket", SIX, 7, 7, throughQuarters);
    expect(scheduleFor("bracket", SIX, 8, throughSemis)).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
      { a: "e", b: "f" },
    ]);

    const season = play("bracket", SIX, 8, 8, throughSemis);
    const bracket = bracketFor(SIX, 8, season);
    expect(bracket?.champion).toBe("a");
    expect(bracket?.rounds[2].matches[0]).toMatchObject({
      a: "a",
      b: "b",
      seedA: 1,
      seedB: 2,
      winner: "a",
    });
  });

  it("needs no byes when the count is a power of two", () => {
    const four = SIX.slice(0, 4);
    const regular = play("bracket", four, 1, 6);
    const bracket = bracketFor(four, 7, regular);
    expect(bracket?.rounds.map((round) => round.name)).toEqual([
      "Semifinals",
      "Final",
    ]);
    expect(scheduleFor("bracket", four, 7, regular)).toEqual([
      { a: "a", b: "d" },
      { a: "b", b: "c" },
    ]);
  });

  it("sends the better seed through a tied match", () => {
    const regular = play("bracket", SIX, 1, 5);
    const tied: Result<string>[] = [
      ...regular,
      { week: 6, a: "e", b: "d", scoreA: 77, scoreB: 77 },
      { week: 6, a: "c", b: "f", scoreA: 10, scoreB: 90 },
    ];
    const bracket = bracketFor(SIX, 7, tied);
    expect(bracket?.rounds[0].matches[1]).toMatchObject({
      a: "d",
      b: "e",
      scoreA: 77,
      scoreB: 77,
      winner: "d",
    });
    // The sixth seed's upset stands.
    expect(bracket?.rounds[1].matches[1]).toMatchObject({ a: "b", b: "f" });
  });

  it("shows a live round's scores without advancing anyone", () => {
    const regular = play("bracket", SIX, 1, 5);
    const live: Result<string>[] = [
      ...regular,
      { week: 6, a: "d", b: "e", scoreA: 30, scoreB: 5, live: true },
    ];
    const bracket = bracketFor(SIX, 6, live);
    expect(bracket?.rounds[0].matches[1]).toMatchObject({
      scoreA: 30,
      scoreB: 5,
      winner: null,
    });
    expect(bracket?.rounds[1].matches[0]).toMatchObject({ a: "a", b: null });
    // Next week's semifinals aren't known yet.
    expect(scheduleFor("bracket", SIX, 7, live)).toEqual([]);
  });

  it("is only a projection while the regular season is being played", () => {
    const bracket = bracketFor(SIX, 3, play("bracket", SIX, 1, 2));
    expect(bracket?.projected).toBe(true);
    expect(bracket?.champion).toBeNull();
  });

  it("takes only the top seeds when the season is too short for everyone", () => {
    // Two weeks leave room for two rounds, so four of the six qualify.
    const bracket = bracketFor(SIX, 1, [], 2);
    expect(bracket?.firstWeek).toBe(1);
    expect(bracket?.rounds[0].matches.map((m) => [m.a, m.b])).toEqual([
      ["a", "d"],
      ["b", "c"],
    ]);
    // The two who missed out play each other.
    expect(scheduleFor("bracket", SIX, 1, [], 2)).toContainEqual({
      a: "e",
      b: "f",
    });
  });

  it("has no bracket for a league of one", () => {
    expect(bracketFor(["a"], 8, [])).toBeNull();
    expect(scheduleFor("bracket", ["a"], 8, [])).toEqual([]);
  });

  it("keeps a player who joins during the playoffs out of the bracket", () => {
    const four = ["a", "b", "c", "d"];
    const regular = play("bracket", four, 1, 6);
    const five = [...four, "e"];
    const joined = new Map([["e", 7]]);

    // Five players would fill a bracket of eight, which starts in week 6:
    // a week these four already played as regular season.
    const bracket = bracketFor(five, 7, regular, 8, joined);
    expect(bracket?.firstWeek).toBe(7);
    expect(bracket?.rounds).toEqual(bracketFor(four, 7, regular)?.rounds);
    expect(bracket?.seeds).toEqual(["a", "b", "c", "d", "e"]);

    // The final, then a consolation game for the semifinal losers. The
    // latecomer is the odd one out and gets a stand-in.
    const semifinals = play("bracket", four, 7, 7, regular);
    expect(scheduleFor("bracket", five, 8, semifinals, 8, joined)).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
    ]);
  });

  it("lets in a player who joined before the playoffs began", () => {
    const five = ["a", "b", "c", "d", "e"];
    const bracket = bracketFor(five, 5, play("bracket", five, 1, 4), 8, new Map([["e", 5]]));
    expect(bracket?.firstWeek).toBe(6);
    expect(bracket?.rounds[0].matches.flatMap((m) => [m.a, m.b])).toContain("e");
  });

  it("does not start in the week a league fills up", () => {
    const five = ["a", "b", "c", "d", "e"];
    const inWeekOne = new Map(five.map((id) => [id, 1]));

    // Three rounds would take all three weeks, and week 1 is already being
    // played as a round robin by whoever had joined.
    const bracket = bracketFor(five, 1, [], 3, inWeekOne);
    expect(bracket?.projected).toBe(true);
    expect(bracket?.rounds.map((round) => [round.week, round.name])).toEqual([
      [2, "Semifinals"],
      [3, "Final"],
    ]);
    expect(scheduleFor("bracket", five, 1, [], 3, inWeekOne)).toEqual(
      scheduleFor("round_robin", five, 1, []),
    );

    // A one-week season has no week to spare, so it has no bracket.
    expect(bracketFor(five, 1, [], 1, inWeekOne)).toBeNull();
  });
});
