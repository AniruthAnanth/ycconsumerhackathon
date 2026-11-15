export type Stake = 0 | 5 | 20;

/** The buy-ins a league can have. Quick Match and Create offer the same three. */
export const STAKES: readonly { stakeUsd: Stake; label: string }[] = [
  { stakeUsd: 0, label: "Free" },
  { stakeUsd: 5, label: "$5" },
  { stakeUsd: 20, label: "$20" },
];
