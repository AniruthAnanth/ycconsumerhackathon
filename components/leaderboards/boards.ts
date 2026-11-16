import type { BoardKey } from "./types";

/** Every board, in the order a player is most likely to want them. The label names the board in the "More boards" list and to a screen reader. */
export const BOARDS: readonly { key: BoardKey; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "season", label: "Season" },
  { key: "allTime", label: "All-Time" },
  { key: "global", label: "Global" },
  { key: "globalAllTime", label: "Global All-Time" },
  { key: "body", label: "Body" },
  { key: "mind", label: "Mind" },
  { key: "recharge", label: "Recharge" },
  { key: "chores", label: "Chores" },
  { key: "people", label: "People" },
  { key: "streak", label: "Streak" },
  { key: "highlights", label: "Best Proofs" },
  { key: "quickTime", label: "Quick-Time" },
  { key: "headToHead", label: "Head-to-Head" },
  { key: "money", label: "Money" },
  { key: "recruiters", label: "Recruiters" },
];

/** The three boards nearly everyone wants get the segmented control; the short text fits a third of a phone. */
export const PRIMARY_BOARDS: readonly { key: BoardKey; segment: string }[] = [
  { key: "week", segment: "Week" },
  { key: "season", segment: "Season" },
  { key: "allTime", segment: "All-time" },
];

const PRIMARY_KEYS = new Set<string>(PRIMARY_BOARDS.map((board) => board.key));

/** The rest sit behind "More boards" so the screen opens on three choices instead of sixteen. */
export const MORE_BOARDS = BOARDS.filter((board) => !PRIMARY_KEYS.has(board.key));

export function isPrimaryBoard(key: BoardKey): boolean {
  return PRIMARY_KEYS.has(key);
}

const BOARD_KEYS = new Set<string>(BOARDS.map((board) => board.key));

/** Narrows a route param to a board, so a stale or mistyped link opens the default instead of an empty screen. */
export function parseBoardKey(value: string | string[] | undefined): BoardKey | undefined {
  const key = Array.isArray(value) ? value[0] : value;
  return key !== undefined && BOARD_KEYS.has(key) ? (key as BoardKey) : undefined;
}
