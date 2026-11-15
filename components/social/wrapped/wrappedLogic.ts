import { colors } from "@/theme";

import type { WrappedCard } from "../contract";

type Kind = WrappedCard["kind"];

export const KIND_LABEL: Record<Kind, string> = {
  champion: "LEAGUE CHAMPION",
  best_proof: "BEST PROOF",
  comeback: "BIGGEST COMEBACK",
  fastest: "FASTEST QUICK-TIME",
  your_week: "YOUR WEEK",
};

/** Solid fill for a card that has no photo or video behind it. */
export const KIND_BACKGROUND: Record<Kind, string> = {
  champion: colors.accent,
  best_proof: colors.tabActive,
  comeback: colors.danger,
  fastest: "#6741D9",
  your_week: colors.text,
};

/** The page a horizontal paging scroll has settled on. */
export function pageIndexFromOffset(offsetX: number, pageWidth: number, pageCount: number): number {
  if (pageWidth <= 0 || pageCount <= 0) return 0;
  return Math.min(Math.max(Math.round(offsetX / pageWidth), 0), pageCount - 1);
}

export function nextIndex(current: number, pageCount: number): number {
  return Math.min(current + 1, pageCount - 1);
}

export function previousIndex(current: number): number {
  return Math.max(current - 1, 0);
}

/** Story taps: the right third advances, the left third goes back, the middle does nothing. */
export function indexAfterTap(tapX: number, pageWidth: number, current: number, pageCount: number): number {
  if (tapX > (pageWidth * 2) / 3) return nextIndex(current, pageCount);
  if (tapX < pageWidth / 3) return previousIndex(current);
  return current;
}
