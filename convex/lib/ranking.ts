/**
 * Ranking maths for leaderboards, as pure functions: places, movement since
 * yesterday, the gap to the player above ("15 behind Maya") and the caller's
 * closest rival.
 *
 * convex/leaderboards.ts loads one number per player (and the same number as it
 * stood yesterday); everything a row says about that number is decided here, so
 * every board reads the same way and the screen only renders strings.
 */

export type Entry<UserId> = {
  userId: UserId;
  name: string;
  avatarUrl?: string;
  value: number;
  /** The same number as it stood yesterday. Null when the player was not on the board then. */
  previous: number | null;
  /** Breaks a tie on value (more is better): points scored behind a win-loss record. */
  tiebreak?: number;
  /** Replaces the formatted value when a number can't say it, such as a "3-1" record. */
  valueLabel?: string;
  /** One line of context under the name: "4/5 slots". */
  detail?: string;
};

export type BoardFormat = {
  /** "desc": the biggest number leads. "asc": the smallest does (a response time). */
  order: "desc" | "asc";
  /** How a value reads in the right-hand column. */
  value: (value: number) => string;
  /** How the difference between two values reads in "15 behind Maya". */
  gap: (difference: number) => string;
};

export type RankedRow<UserId> = {
  rank: number;
  userId: UserId;
  name: string;
  avatarUrl?: string;
  value: number;
  valueLabel: string;
  detail?: string;
  /** Places gained since yesterday: 2 is up two, -1 is down one. */
  movement: number;
  /** "15 behind Maya", or "15 ahead of Sam" for the leader. Absent on a board of one. */
  gapLabel?: string;
  isMe: boolean;
  isRival: boolean;
};

export type Rival<UserId> = { userId: UserId; name: string; label: string };

export type RankedBoard<UserId> = { rows: RankedRow<UserId>[]; rival?: Rival<UserId> };

const usd = (dollars: number) => `$${Math.abs(dollars).toFixed(2)}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** One format per kind of number a board can rank by. */
export const FORMATS = {
  points: { order: "desc", value: (n) => String(n), gap: (n) => String(n) },
  // Signed, because the money board is what a player is up or down.
  money: { order: "desc", value: (n) => (n === 0 ? usd(n) : `${n < 0 ? "-" : "+"}${usd(n)}`), gap: usd },
  wins: { order: "desc", value: (n) => String(n), gap: (n) => plural(n, "win") },
  days: { order: "desc", value: (n) => String(n), gap: (n) => plural(n, "day") },
  highlight: { order: "desc", value: (n) => `${n}/10`, gap: (n) => String(n) },
  seconds: { order: "asc", value: formatDuration, gap: formatDuration },
} satisfies Record<string, BoardFormat>;

/** "42s" under a minute, "3m 05s" above it: a quick-time response is read at a glance. */
export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s`;
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(place: number): string {
  const lastTwo = place % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${place}th`;
  return `${place}${["th", "st", "nd", "rd"][place % 10] ?? "th"}`;
}

/**
 * Turns one number per player into a board, best first.
 *
 * Players level on value and tiebreak share a place and the next place is
 * skipped (1, 2, 2, 4), as a sports table does. `splitTies` numbers them
 * straight through instead (1, 2, 3, 4, level players by name), for a board
 * that has to show the places another table already gives.
 */
export function rankBoard<UserId>(
  entries: Entry<UserId>[],
  format: BoardFormat,
  me: UserId | null,
  { splitTies = false }: { splitTies?: boolean } = {},
): RankedBoard<UserId> {
  const better = (a: Scored, b: Scored) =>
    (format.order === "desc" ? b.value - a.value : a.value - b.value) || b.tiebreak - a.tiebreak;

  const today = placed(
    entries.map((entry) => ({ entry, value: entry.value, tiebreak: entry.tiebreak ?? 0 })),
    better,
    splitTies,
  );
  // Yesterday's table, to compare places. A player who was not on it counts as
  // having stood below everyone who was, so arriving on a board reads as a climb.
  const yesterday = placed(
    entries
      .filter((entry) => entry.previous !== null)
      .map((entry) => ({ entry, value: entry.previous as number, tiebreak: entry.tiebreak ?? 0 })),
    better,
    splitTies,
  );
  const placeYesterday = new Map(yesterday.map(({ entry, place }) => [entry.userId, place]));

  const mine = today.findIndex(({ entry }) => entry.userId === me);
  const rivalAt = closestRival(today, mine);

  const rows = today.map(({ entry, place }, i): RankedRow<UserId> => {
    const gapLabel = gapTo(today, i, format, splitTies);
    // A player with nothing on a board has no place to lose: without this, everyone still on
    // zero shows a fall each time somebody else scores.
    const idle = entry.value === 0 && (entry.previous ?? 0) === 0;
    return {
      rank: place,
      userId: entry.userId,
      name: entry.name,
      ...(entry.avatarUrl === undefined ? {} : { avatarUrl: entry.avatarUrl }),
      value: entry.value,
      valueLabel: entry.valueLabel ?? format.value(entry.value),
      ...(entry.detail === undefined ? {} : { detail: entry.detail }),
      movement: idle ? 0 : (placeYesterday.get(entry.userId) ?? yesterday.length + 1) - place,
      ...(gapLabel === undefined ? {} : { gapLabel }),
      isMe: i === mine,
      isRival: i === rivalAt,
    };
  });

  if (rivalAt === -1) return { rows };
  const rival = today[rivalAt].entry;
  const difference = Math.abs(rival.value - today[mine].entry.value);
  return {
    rows,
    rival: {
      userId: rival.userId,
      name: rival.name,
      label:
        difference === 0
          ? `You and ${rival.name} are level`
          : `${rival.name} is ${format.gap(difference)} ${rivalAt < mine ? "ahead of" : "behind"} you`,
    },
  };
}

type Scored = { value: number; tiebreak: number };
type Placed<UserId> = { entry: Entry<UserId>; place: number };

function placed<UserId>(
  scored: ({ entry: Entry<UserId> } & Scored)[],
  better: (a: Scored, b: Scored) => number,
  splitTies: boolean,
): Placed<UserId>[] {
  // Level players are listed by name so the order never flickers between renders.
  const sorted = [...scored].sort((a, b) => better(a, b) || a.entry.name.localeCompare(b.entry.name));
  const result: Placed<UserId>[] = [];
  sorted.forEach((row, i) => {
    const level = !splitTies && i > 0 && better(sorted[i - 1], row) === 0;
    result.push({ entry: row.entry, place: level ? result[i - 1].place : i + 1 });
  });
  return result;
}

/**
 * What a row says about its neighbour: the distance to the player above, or
 * for the leader the cushion over the player below.
 */
function gapTo<UserId>(
  board: Placed<UserId>[],
  i: number,
  format: BoardFormat,
  splitTies: boolean,
): string | undefined {
  const neighbour = board[i === 0 ? 1 : i - 1];
  if (neighbour === undefined) return undefined;
  const difference = Math.abs(neighbour.entry.value - board[i].entry.value);
  // On a board that numbers level players straight through, "level" beside two different
  // places reads as a contradiction; the score is what the two share.
  if (difference === 0) return `${splitTies ? "Same score as" : "Level with"} ${neighbour.entry.name}`;
  return `${format.gap(difference)} ${i === 0 ? "ahead of" : "behind"} ${neighbour.entry.name}`;
}

/**
 * The neighbour (directly above or below) nearest in value. Level gaps go to
 * the player above: the one you can still catch is the better rival.
 */
function closestRival<UserId>(board: Placed<UserId>[], mine: number): number {
  if (mine === -1) return -1;
  const distance = (i: number) =>
    board[i] === undefined ? Infinity : Math.abs(board[i].entry.value - board[mine].entry.value);
  const above = distance(mine - 1);
  const below = distance(mine + 1);
  if (above === Infinity && below === Infinity) return -1;
  return above <= below ? mine - 1 : mine + 1;
}
