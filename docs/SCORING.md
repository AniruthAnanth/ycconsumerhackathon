# Scoring and settlement

The rules are pure functions in `convex/lib/`, each with a test file beside it. `convex/standings.ts` loads the rows and calls them inside a query, so these numbers are recomputed whenever a proof lands.

## Points (`convex/lib/scoring.ts`)

- **A task** is worth 10 to 50 points (`clampTaskPoints`). A verified task pays its points. Open, held (under challenge) and failed-but-retryable tasks pay nothing.
- **Slots.** The five core slots are body, mind, recharge, chores and people. Only drafted tasks clear a slot. Each cleared slot is +25, and clearing all five adds +100 (`slotBonus`).
- **Streak.** Day n of an unbroken run of proof days pays 5 × n, capped at 25 a day (`streakBonus`).
- **Week total** is task points + slot bonus + streak bonus (`scoreWeek`). A player who cleared all five slots is a finisher.
- **Matchup.** The higher scorer of a head-to-head pair gets +50; a tie pays nobody (`matchupBonus`).
- **Quick-time drop.** It pays its own points, plus 10 to the first finisher (`quickTimeScore`).
- **Group session.** It pays the task's points plus 5 per other attendee, capped at +25 (`groupSessionScore`).
- **Challenges** (`convex/challenges.ts`). A challenge can be opened within 24 hours of a proof, and voting lasts 12 hours. If the proof is upheld, its points return and the challenger loses 10 points. If it is overturned, the task reopens and the challenger gains 10.

## The referee (`convex/lib/verdict.ts`, `convex/lib/geo.ts`)

The model describes the photo, and pure code decides. Confidence under 0.6 fails, and 0.6 to 0.75 passes as a close call. A location task also needs the phone within 150 m of the pinned place. A failed proof leaves the task open for a retry until the week ends.

## Settlement (`convex/lib/settlement.ts`)

All amounts are whole cents.

1. The pot is the stake × the number of paid members. Unpaid members play but put nothing in and take nothing out.
2. If nobody finished, every stake is refunded and no fee is taken.
3. Otherwise each finisher gets their stake back. The stakes of paid non-finishers are forfeited.
4. The platform fee is 10% of the forfeited stakes only (`PLATFORM_FEE_RATE`). Returned stakes are never charged.
5. The rest of the forfeited stakes is split among finishers in proportion to their points, by largest remainder, so the parts add up exactly (`splitByWeight`).
6. `settlementLedgerRows` writes one refund row and one winnings row per paid-out member, plus one fee row. Each row has an idempotency key, so settling twice writes nothing new, and the rows sum to the pot.

Worked example: six paid players at $20 make a $120 pot. If four finish, the two forfeited stakes are $40, the fee is $4, and the four finishers split $36 by points on top of their own $20 back.
