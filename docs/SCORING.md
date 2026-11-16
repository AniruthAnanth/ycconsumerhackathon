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

1. The pot is the stake × the number of paid members, plus anything an earlier week rolled over. Unpaid members play but put nothing in and take nothing out.
2. The top performers are the paid members tied for the most slots cleared that week, even when that is fewer than five. They split the pot evenly, by largest remainder, so the parts add up exactly (`splitByWeight`). If everyone clears all five, everyone splits it. Points don't affect the split.
3. If no paid member cleared a slot, nobody wins and the whole pot rolls into next week.
4. A league settlement takes no fee. A 1v1 versus keeps its own rule (`convex/lib/versusSettlement.ts`).
5. `settlementLedgerRows` writes one `winnings` row per top performer. That row is their credit in the league's escrow, and nothing is sent when the week settles. A pot nobody won is a positive `rollover` row, and a later week that shares it out writes the matching negative one, so the league's rollover rows always sum to what is still waiting to be won. Every row has an idempotency key, so settling twice writes nothing new.

## Escrow and cashout (`convex/whop.ts`)

Shares stay in the league's escrow until it cashes out at the end of each season. In the season's last week, `settleInLedger` returns every unsent share from the season's weeks, and `payOnWhop` sends each member one transfer. A refused transfer leaves its rows unsent, and `retryPayouts` sends them later. A 1v1 versus is a one-week season, so it cashes out when it settles.

Worked example: six paid players at $20 make a $120 pot. If two of them clear all five and nobody else does, each has $60 in escrow until the season ends. If the best anyone manages is four slots and three players do, each gets $40. If no paid player clears a slot, next week's pot starts at $120.
