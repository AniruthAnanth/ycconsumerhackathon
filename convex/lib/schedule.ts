// League formats: who plays whom in each week of a season.
//
// Everything here is pure (ids in, pairings out) so it can be tested without a
// database. convex/seasons.ts loads the rows and calls in; leagues.ts calls
// scheduleFor when it opens a week.
//
// Three ideas run through the file:
// - Week numbers are the league's own (weeks.number, starting at 1) and never
//   reset. A league keeps playing after its season ends, so week
//   seasonWeeks + 1 opens season 2; seasonOf maps a week to its season.
// - Members are scheduled in the order given. Callers pass them in join order
//   (the memberships by_league index), so every caller gets the same schedule
//   and an earlier joiner wins a tie in the table.
// - A member with no pairing in a week has a bye. leagues.ts stores a
//   stand-in matchup for them (withStandIns) so their Matchup tab is not
//   empty; it is not a result, and withoutStandIns takes it out again.

export type Payout = "weekly" | "season";
export type LeagueFormat = "round_robin" | "double_round_robin" | "bracket";

export type LeagueSettings = {
  payout: Payout;
  seasonWeeks: number;
  format: LeagueFormat;
};

/** What a league created before settings existed, or without any, plays by. */
export const DEFAULT_SETTINGS: LeagueSettings = {
  payout: "weekly",
  seasonWeeks: 8,
  format: "round_robin",
};

export const MAX_SEASON_WEEKS = 52;

/** A season is a whole number of weeks, from one to a year. */
export function isSeasonLength(weeks: number): boolean {
  return Number.isInteger(weeks) && weeks >= 1 && weeks <= MAX_SEASON_WEEKS;
}

/** Fills in the defaults for whatever a leagues row leaves unset. */
export function resolveSettings(stored: Partial<LeagueSettings>): LeagueSettings {
  const weeks = stored.seasonWeeks;
  return {
    payout: stored.payout ?? DEFAULT_SETTINGS.payout,
    seasonWeeks:
      weeks !== undefined && isSeasonLength(weeks)
        ? weeks
        : DEFAULT_SETTINGS.seasonWeeks,
    format: stored.format ?? DEFAULT_SETTINGS.format,
  };
}

export type Season = {
  number: number; // 1 for the league's first season
  firstWeek: number; // league week numbers, inclusive
  lastWeek: number;
};

/** The season a league week falls in. */
export function seasonOf(weekNumber: number, seasonWeeks: number): Season {
  const index = Math.floor((weekNumber - 1) / seasonWeeks);
  return {
    number: index + 1,
    firstWeek: index * seasonWeeks + 1,
    lastWeek: (index + 1) * seasonWeeks,
  };
}

/** True in the week a "season" payout settles. */
export function isFinalWeek(weekNumber: number, seasonWeeks: number): boolean {
  return weekNumber === seasonOf(weekNumber, seasonWeeks).lastWeek;
}

export type Pairing<Id> = { a: Id; b: Id };

/**
 * One head-to-head and each side's points. live marks a week still being
 * played: its scores are shown, but it counts in no table and advances nobody
 * in a bracket.
 */
export type Result<Id> = Pairing<Id> & {
  week: number;
  scoreA: number;
  scoreB: number;
  live?: boolean;
};

/**
 * The single entry point: the pairings for one league week.
 *
 * results are the league's earlier matchups. Only the bracket reads them (to
 * seed it and to advance winners), so the round-robin formats accept []. The
 * same goes for joinedWeeks, which bracketFor explains.
 */
export function scheduleFor<Id extends string>(
  format: LeagueFormat,
  memberIds: readonly Id[],
  weekNumber: number,
  results: readonly Result<Id>[],
  seasonWeeks: number = DEFAULT_SETTINGS.seasonWeeks,
  joinedWeeks: ReadonlyMap<Id, number> = new Map(),
): Pairing<Id>[] {
  const ids = unique(memberIds);
  const season = seasonOf(weekNumber, seasonWeeks);
  const round = weekNumber - season.firstWeek;

  if (format === "bracket") {
    const bracket = bracketFor(ids, weekNumber, results, seasonWeeks, joinedWeeks);
    if (bracket !== null && weekNumber >= bracket.firstWeek) {
      return playoffPairings(bracket, weekNumber);
    }
    return roundRobinRound(ids, round, false);
  }
  return roundRobinRound(ids, round, format === "double_round_robin");
}

// ---------------------------------------------------------------------------
// Round robin

/**
 * The circle method: seat everyone around a table, keep the first seat fixed
 * and move everyone else one seat each round; each seat plays the one
 * opposite. With an odd count one seat stays empty and whoever faces it has
 * the week off.
 *
 * Members take their seats alternately from the two ends of the table, so the
 * first round pairs neighbours in join order: first v second, third v fourth.
 * That is the week a league builds as its members join one by one
 * (pairsAfterJoin in lib/week.ts). The week a league fills up is therefore
 * the first round, and the weeks after it carry the rotation on instead of
 * meeting the same opponent again.
 *
 * After everyone has met once the rotation starts again, which is what fills
 * a season longer than one cycle. A double round robin differs in that second
 * pass only: it is the return leg, with the two sides swapped.
 */
function roundRobinRound<Id>(
  ids: readonly Id[],
  round: number,
  double: boolean,
): Pairing<Id>[] {
  const members: (Id | null)[] = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  if (members.length < 2) {
    return [];
  }
  const seats = [
    ...members.filter((_, index) => index % 2 === 0),
    ...members.filter((_, index) => index % 2 === 1).reverse(),
  ];
  const roundsPerCycle = seats.length - 1;
  const turn = round % roundsPerCycle;
  const moving = seats.slice(1);
  const table = [seats[0], ...moving.slice(turn), ...moving.slice(0, turn)];
  const returnLeg = double && Math.floor(round / roundsPerCycle) % 2 === 1;

  const pairings: Pairing<Id>[] = [];
  for (let seat = 0; seat < seats.length / 2; seat++) {
    const near = table[seat];
    const far = table[seats.length - 1 - seat];
    if (near === null || far === null) {
      continue;
    }
    pairings.push(returnLeg ? { a: far, b: near } : { a: near, b: far });
  }
  return pairings;
}

// ---------------------------------------------------------------------------
// Season table

export type TableRow<Id> = {
  id: Id;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

/** The side with more points, or null for a tie or a week still in play. */
export function winnerOf<Id>(result: Result<Id>): Id | null {
  if (result.live === true || result.scoreA === result.scoreB) {
    return null;
  }
  return result.scoreA > result.scoreB ? result.a : result.b;
}

/**
 * Wins, losses and points for every member, best first: most wins, then most
 * points for, then whoever joined first. Live results are left out, and so is
 * a side that has since left the league.
 */
export function seasonTable<Id extends string>(
  memberIds: readonly Id[],
  results: readonly Result<Id>[],
): TableRow<Id>[] {
  const rows = new Map<Id, TableRow<Id>>();
  for (const id of memberIds) {
    rows.set(id, { id, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
  }
  for (const result of results) {
    // The week in play adds to points for at once; its win, loss and points against wait for the result.
    if (result.live === true) {
      for (const [id, scored] of [[result.a, result.scoreA], [result.b, result.scoreB]] as const) {
        const row = rows.get(id);
        if (row !== undefined) row.pointsFor += scored;
      }
      continue;
    }
    const winner = winnerOf(result);
    const sides = [
      { id: result.a, scored: result.scoreA, conceded: result.scoreB },
      { id: result.b, scored: result.scoreB, conceded: result.scoreA },
    ];
    for (const side of sides) {
      const row = rows.get(side.id);
      if (row === undefined) {
        continue;
      }
      row.pointsFor += side.scored;
      row.pointsAgainst += side.conceded;
      if (winner === null) {
        row.ties += 1;
      } else if (winner === side.id) {
        row.wins += 1;
      } else {
        row.losses += 1;
      }
    }
  }
  // The sort is stable, so rows level on both counts stay in join order.
  return [...rows.values()].sort(
    (x, y) => y.wins - x.wins || y.pointsFor - x.pointsFor,
  );
}

// ---------------------------------------------------------------------------
// Bracket

export type BracketMatch<Id> = {
  // null until the match that feeds this side is decided. b is also null for
  // a first-round bye.
  a: Id | null;
  b: Id | null;
  seedA: number | null;
  seedB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: Id | null;
  bye: boolean;
};

export type BracketRound<Id> = {
  week: number; // league week number
  name: string; // "Quarterfinals", "Semifinals", "Final"
  matches: BracketMatch<Id>[];
};

export type Bracket<Id> = {
  // Every member in seed order; seeds[0] is the first seed. When the season
  // is too short for everyone to fit, only the top of the list is in rounds.
  // Members who joined too late for the bracket come last and are in none.
  seeds: Id[];
  // Until the regular season is over the seeds are only "if it ended today".
  projected: boolean;
  firstWeek: number; // league week number of the first round
  rounds: BracketRound<Id>[];
  champion: Id | null;
};

/**
 * The playoff bracket of the season weekNumber falls in, or null for a league
 * too small to have one.
 *
 * The bracket takes the last weeks of the season, one round a week, and the
 * weeks before it are a round robin. Seeds are that regular season's table.
 * Everyone qualifies when the season has room for enough rounds; a field that
 * is not a power of two gives the top seeds a bye in the first round. A tied
 * match goes to the better seed, because a bracket needs a winner.
 *
 * The field is whoever had joined before the bracket's first week began.
 * joinedWeeks gives the league week a member joined in; a member it leaves
 * out was there from the start. Without that rule a fifth player joining a
 * league of four during the semifinals would make it a bracket of eight, one
 * round longer, and the week before, already played as regular season, would
 * become a quarterfinal nobody played. So latecomers get consolation games,
 * and a league that fills up in week 1 never starts its bracket there.
 */
export function bracketFor<Id extends string>(
  memberIds: readonly Id[],
  weekNumber: number,
  results: readonly Result<Id>[],
  seasonWeeks: number = DEFAULT_SETTINGS.seasonWeeks,
  joinedWeeks: ReadonlyMap<Id, number> = new Map(),
): Bracket<Id> | null {
  const ids = unique(memberIds);
  if (ids.length < 2) {
    return null;
  }
  const season = seasonOf(weekNumber, seasonWeeks);

  // The most rounds that have a field big enough to need them: more players
  // than the round after the first would hold.
  let roundCount = Math.min(Math.ceil(Math.log2(ids.length)), seasonWeeks);
  let firstWeek = season.lastWeek - roundCount + 1;
  let field = ids.filter((id) => (joinedWeeks.get(id) ?? 0) < firstWeek);
  while (field.length <= 2 ** (roundCount - 1)) {
    roundCount -= 1;
    if (roundCount === 0) {
      return null;
    }
    firstWeek = season.lastWeek - roundCount + 1;
    field = ids.filter((id) => (joinedWeeks.get(id) ?? 0) < firstWeek);
  }
  const size = 2 ** roundCount;

  const regularSeason = results.filter(
    (result) => result.week >= season.firstWeek && result.week < firstWeek,
  );
  const entrants = seasonTable(field, regularSeason).map((row) => row.id);
  const inField = new Set(field);
  const seeds = [...entrants, ...ids.filter((id) => !inField.has(id))];
  const seedOf = new Map(seeds.map((id, index) => [id, index + 1]));

  const rounds: BracketRound<Id>[] = [];
  for (let round = 0; round < roundCount; round++) {
    const week = firstWeek + round;
    const previous = rounds[round - 1];
    const sides: (Id | null)[] =
      previous === undefined
        ? firstRoundSeeds(size).map((seed) => entrants[seed - 1] ?? null)
        : previous.matches.map((match) => match.winner);

    const matches: BracketMatch<Id>[] = [];
    for (let slot = 0; slot < sides.length; slot += 2) {
      const a = sides[slot];
      const b = sides[slot + 1];
      const match: BracketMatch<Id> = {
        a,
        b,
        seedA: a === null ? null : (seedOf.get(a) ?? null),
        seedB: b === null ? null : (seedOf.get(b) ?? null),
        scoreA: null,
        scoreB: null,
        winner: null,
        // Only the first round has byes: after it every side is a winner.
        bye: round === 0 && b === null,
      };
      if (match.bye) {
        match.winner = a;
      } else if (a !== null && b !== null) {
        const played = results.find(
          (result) =>
            result.week === week &&
            ((result.a === a && result.b === b) ||
              (result.a === b && result.b === a)),
        );
        if (played !== undefined) {
          const flipped = played.a !== a;
          match.scoreA = flipped ? played.scoreB : played.scoreA;
          match.scoreB = flipped ? played.scoreA : played.scoreB;
          if (played.live !== true) {
            const betterSeed = (match.seedA ?? 0) <= (match.seedB ?? 0) ? a : b;
            match.winner = winnerOf(played) ?? betterSeed;
          }
        }
      }
      matches.push(match);
    }
    rounds.push({ week, name: roundName(matches.length), matches });
  }

  return {
    seeds,
    projected: weekNumber < firstWeek,
    firstWeek,
    rounds,
    champion: rounds[rounds.length - 1].matches[0].winner,
  };
}

/**
 * Seed numbers in first-round order for a bracket of the given size, two per
 * match: [1, 8, 4, 5, 2, 7, 3, 6] for eight. Built by repeatedly pairing each
 * seed with the weakest one left, which keeps seeds 1 and 2 apart until the
 * final and always puts the better seed first.
 */
function firstRoundSeeds(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const field = order.length * 2;
    order = order.flatMap((seed) => [seed, field + 1 - seed]);
  }
  return order;
}

function roundName(matchCount: number): string {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semifinals";
  if (matchCount === 4) return "Quarterfinals";
  return "Round of " + matchCount * 2;
}

/**
 * A playoff week's pairings: the bracket matches whose two sides are known,
 * then consolation games. Everyone still drafts a lineup every week, so
 * players who are out of the bracket are paired with each other, in seed
 * order, to keep a matchup on their Matchup tab. A seed with a bye sits out.
 */
function playoffPairings<Id extends string>(
  bracket: Bracket<Id>,
  weekNumber: number,
): Pairing<Id>[] {
  const round = bracket.rounds[weekNumber - bracket.firstWeek];
  const pairings: Pairing<Id>[] = [];
  const stillIn = new Set<Id>();
  let roundIsSet = true;
  for (const match of round.matches) {
    if (match.a !== null) stillIn.add(match.a);
    if (match.b !== null) stillIn.add(match.b);
    if (match.a !== null && match.b !== null) {
      pairings.push({ a: match.a, b: match.b });
    } else if (!match.bye) {
      roundIsSet = false;
    }
  }
  // Until the round before is decided we can't tell who is out.
  if (!roundIsSet) {
    return pairings;
  }

  const out = bracket.seeds.filter((id) => !stillIn.has(id));
  for (let i = 0; i + 1 < out.length; i += 2) {
    pairings.push({ a: out[i], b: out[i + 1] });
  }
  return pairings;
}

// ---------------------------------------------------------------------------
// Stand-ins

/**
 * What leagues.ts stores for a week: the pairings, then a stand-in matchup
 * for every member they leave out, against the first paired member. Stand-ins
 * come last and always put the member with the week off first; the mid-week
 * join in lib/week.ts relies on both.
 */
export function withStandIns<Id>(
  pairings: readonly Pairing<Id>[],
  memberIds: readonly Id[],
): Pairing<Id>[] {
  if (pairings.length === 0) {
    return [];
  }
  const playing = new Set(pairings.flatMap((pairing) => [pairing.a, pairing.b]));
  const standIns = memberIds
    .filter((id) => !playing.has(id))
    .map((id) => ({ a: id, b: pairings[0].a }));
  return [...pairings, ...standIns];
}

/**
 * A stored week's real head-to-heads, in the order they were stored. A
 * stand-in is the matchup of a player who already plays that week, so it is
 * recognised without a flag on the row; that also covers the stand-in a
 * mid-week joiner is given.
 */
export function withoutStandIns<P extends Pairing<unknown>>(stored: readonly P[]): P[] {
  const playing = new Set<unknown>();
  return stored.filter(({ a, b }) => {
    if (playing.has(a) || playing.has(b)) {
      return false;
    }
    playing.add(a);
    playing.add(b);
    return true;
  });
}

function unique<Id>(ids: readonly Id[]): Id[] {
  return [...new Set(ids)];
}
