import type { WrappedCard } from "../contract";

type Kind = WrappedCard["kind"];

export const KIND_LABEL: Record<Kind, string> = {
  champion: "LEAGUE CHAMPION",
  best_proof: "BEST PROOF",
  comeback: "BIGGEST COMEBACK",
  fastest: "FASTEST QUICK-TIME",
  your_week: "YOUR WEEK",
};

/**
 * Solid fill for a card that has no photo or video behind it. Plain hex rather
 * than theme tokens: the theme imports react-native, which vitest cannot load.
 */
export const KIND_BACKGROUND: Record<Kind, string> = {
  champion: "#0B69FF",
  best_proof: "#00A651",
  comeback: "#E8590C",
  fastest: "#6741D9",
  your_week: "#121213",
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

const isForwardTap = (tapX: number, pageWidth: number) => tapX > (pageWidth * 2) / 3;

/** Story taps: the right third advances, the left third goes back, the middle does nothing. */
export function indexAfterTap(tapX: number, pageWidth: number, current: number, pageCount: number): number {
  if (isForwardTap(tapX, pageWidth)) return nextIndex(current, pageCount);
  if (tapX < pageWidth / 3) return previousIndex(current);
  return current;
}

/** A forward tap on the last card has no card to go to, so it ends the story like the close button. */
export function tapClosesStory(tapX: number, pageWidth: number, current: number, pageCount: number): boolean {
  return isForwardTap(tapX, pageWidth) && current >= pageCount - 1;
}
