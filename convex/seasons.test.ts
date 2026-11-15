import { describe, expect, it } from "vitest";

import { resolveSettings, scheduleFor, type LeagueFormat, type Result } from "./lib/schedule";
import { buildSeason, type SeasonInput } from "./seasons";

const SIX = ["a", "b", "c", "d", "e", "f"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A league of SIX that has opened weeks 1..opened, the alphabetically earlier
 * id winning every match. The newest week is live unless said otherwise.
 */
function league(
  format: LeagueFormat,
  opened: number,
  { newestIsLive = true, seasonWeeks = 8 } = {},
): SeasonInput<string> {
  const settings = resolveSettings({ format, seasonWeeks });
  const results: Result<string>[] = [];
  for (let week = 1; week <= opened; week++) {
    const live = week === opened && newestIsLive;
    for (const pairing of scheduleFor(format, SIX, week, results, seasonWeeks)) {
      results.push({
        ...pairing,
        week,
        scoreA: 200 - pairing.a.charCodeAt(0),
        scoreB: 200 - pairing.b.charCodeAt(0),
        ...(live ? { live } : {}),
      });
    }
  }
  return {
    settings,
    members: SIX.map((id) => ({ id, joinedAt: 0 })),
    openedWeeks: Array.from({ length: opened }, (_, i) => ({
      number: i + 1,
      startsAt: i * WEEK_MS,
      endsAt: (i + 1) * WEEK_MS,
      live: i + 1 === opened && newestIsLive,
    })),
    results,
  };
}

describe("buildSeason", () => {
  it("shows week 5 of an 8-week double round robin", () => {
    const season = buildSeason(league("double_round_robin", 5));

    expect(season.season).toBe(1);
    expect(season.currentWeek).toBe(5);
    expect(season.weeks.map((week) => week.status)).toEqual([
      "final", "final", "final", "final", "live", "upcoming", "upcoming", "upcoming",
    ]);
    expect(season.bracket).toBeNull();

    // Four weeks are in the table; the live one is not.
    expect(season.table.map((row) => row.wins + row.losses + row.ties)).toEqual([
      4, 4, 4, 4, 4, 4,
    ]);
    expect(season.table.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(season.table[0]).toMatchObject({ id: "a", wins: 4, losses: 0 });

    const live = season.weeks[4];
    expect(live.matchups).toHaveLength(3);
    expect(live.matchups[0].scoreA).not.toBeNull();
    expect(live.matchups.map((matchup) => matchup.winnerId)).toEqual([null, null, null]);

    // Week 6 opens the return leg: week 1 again with the sides swapped.
    const first = season.weeks[0].matchups.map(({ a, b }) => ({ a, b }));
    expect(season.weeks[5].matchups).toEqual(
      first.map(({ a, b }) => ({ a: b, b: a, scoreA: null, scoreB: null, winnerId: null })),
    );
  });

  it("has every week still to come before a league opens its first", () => {
    const season = buildSeason({ ...league("round_robin", 0), results: [] });
    expect(season.currentWeek).toBe(1);
    expect(season.weeks.every((week) => week.status === "upcoming")).toBe(true);
    expect(season.weeks[0].matchups).toHaveLength(3);
  });

  it("starts a new season when the league outlasts the first", () => {
    const input = league("round_robin", 10);
    const season = buildSeason(input);
    expect(season.season).toBe(2);
    expect(season.currentWeek).toBe(2);
    expect(season.weeks).toHaveLength(8);
    // Only week 9 counts: weeks 1 to 8 were last season and week 10 is live.
    expect(season.table.map((row) => row.wins + row.losses)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("lists a week's byes but not for someone who joined later", () => {
    const input = league("round_robin", 2);
    const withLateJoiner = {
      ...input,
      members: [...input.members, { id: "g", joinedAt: 1.5 * WEEK_MS }],
    };
    const season = buildSeason(withLateJoiner);
    expect(season.weeks[0].byes).toEqual([]);
    expect(season.weeks[1].byes).toEqual(["g"]);
    // With seven members someone always sits out from here on.
    expect(season.weeks[2].byes).toHaveLength(1);
  });

  describe("bracket format", () => {
    it("projects the bracket during the regular season and leaves playoff weeks open", () => {
      const season = buildSeason(league("bracket", 5));
      expect(season.bracket?.projected).toBe(true);
      expect(season.bracket?.rounds.map((round) => [round.week, round.name])).toEqual([
        [6, "Quarterfinals"],
        [7, "Semifinals"],
        [8, "Final"],
      ]);
      expect(season.weeks.slice(5).map((week) => [week.round, week.matchups, week.byes])).toEqual([
        ["Quarterfinals", [], []],
        ["Semifinals", [], []],
        ["Final", [], []],
      ]);
    });

    it("sets the first round once the regular season is over", () => {
      const season = buildSeason(league("bracket", 5, { newestIsLive: false }));
      const quarterfinals = season.weeks[5];
      expect(quarterfinals.matchups.map(({ a, b }) => [a, b])).toEqual([
        ["d", "e"],
        ["c", "f"],
      ]);
      expect(quarterfinals.byes).toEqual(["a", "b"]);
    });

    it("keeps playoff games out of the table and shows the live round's scores", () => {
      const season = buildSeason(league("bracket", 6));
      expect(season.bracket?.projected).toBe(false);
      expect(season.table.map((row) => row.wins + row.losses)).toEqual([5, 5, 5, 5, 5, 5]);
      expect(season.weeks[5]).toMatchObject({ status: "live", round: "Quarterfinals", byes: ["a", "b"] });
      expect(season.bracket?.rounds[0].matches[1]).toMatchObject({
        a: "d",
        b: "e",
        scoreA: 100,
        scoreB: 99,
        winner: null,
      });
      expect(season.bracket?.champion).toBeNull();
    });

    it("keeps the bracket as it was drawn when someone joins during the playoffs", () => {
      const input = league("bracket", 7, { newestIsLive: false });
      // Week 6, the quarterfinals, began at 5 * WEEK_MS. As a seventh seed
      // the newcomer would have been owed a game against b, who had a bye.
      const season = buildSeason({
        ...input,
        members: [...input.members, { id: "g", joinedAt: 5.5 * WEEK_MS }],
      });
      expect(season.bracket).toEqual(buildSeason(input).bracket);
      expect(season.weeks[7].matchups.map(({ a, b }) => [a, b])).toContainEqual(["a", "b"]);
      expect(season.weeks[7].byes).toEqual(["g"]);
    });

    it("shows who went through when a playoff game is tied", () => {
      const input = league("bracket", 6, { newestIsLive: false });
      const tied = input.results.map((result) =>
        result.week === 6 ? { ...result, scoreA: 80, scoreB: 80 } : result,
      );
      const season = buildSeason({ ...input, results: tied });

      // d is the fourth seed and e the fifth; c is third and f sixth.
      expect(season.weeks[5].matchups.map(({ a, b, winnerId }) => [a, b, winnerId])).toEqual([
        ["d", "e", "d"],
        ["c", "f", "c"],
      ]);
      // A tie in the regular season is still nobody's win.
      const regularTie = input.results.map((result) =>
        result.week === 1 ? { ...result, scoreA: 80, scoreB: 80 } : result,
      );
      expect(
        buildSeason({ ...input, results: regularTie }).weeks[0].matchups.map((m) => m.winnerId),
      ).toEqual([null, null, null]);
    });

    it("crowns a champion when the final is over", () => {
      const season = buildSeason(league("bracket", 8, { newestIsLive: false }));
      expect(season.bracket?.champion).toBe("a");
      expect(season.weeks[7]).toMatchObject({ status: "final", round: "Final" });
    });
  });
});
