import type { Market } from "./useMarket";

export type MarketQuestion = { key: string; question: string; answer: string; chance: number };

/**
 * The League tab's question cards, all read off the same market: whether you beat this week's
 * opponent, and whether the most interesting chaser clears all five. Who wins the pot is the board
 * right below, so it isn't asked twice. A pure function, so the wording is tested. Up to two cards.
 */
export function marketQuestions(market: Market): MarketQuestion[] {
  const questions: MarketQuestion[] = [];
  if (market.matchup) {
    questions.push({
      key: "matchup",
      question: `Will you beat ${market.matchup.opponentName}?`,
      answer: "Yes",
      chance: market.matchup.chance,
    });
  }
  // The closest race to clearing all five: someone who hasn't yet and whose chance is nearest a coin flip.
  const chaser = market.odds.rows
    .filter((row) => row.finishChance < 1)
    .sort((a, b) => Math.abs(a.finishChance - 0.5) - Math.abs(b.finishChance - 0.5))[0];
  if (chaser) {
    questions.push({
      key: "clear",
      question: `Will ${chaser.isMe ? "you" : chaser.name} clear all 5?`,
      answer: "Yes",
      chance: chaser.finishChance,
    });
  }
  return questions;
}

/** "The pot needs all 5 slots cleared — you've cleared 2." Under the money line, so a big matchup chance next to a loss reads right. */
export function potNeedsLine(slotsCleared: number): string {
  if (slotsCleared >= 5) return "You've cleared all 5 slots, so you're in the running for the pot.";
  return `The pot needs all 5 slots cleared — you've cleared ${slotsCleared}.`;
}
