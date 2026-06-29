import type { HandResult, Player, ScoringRules } from '@/types/game'

/**
 * Sequence of hand sizes for an "up and down the river" game.
 * Example for maxCards=7: 7,6,5,4,3,2,1,2,3,4,5,6,7  (13 hands).
 */
export function handSizeSequence(maxCards: number): number[] {
  if (maxCards < 1) return []
  const down: number[] = []
  for (let n = maxCards; n >= 1; n--) down.push(n)
  const up: number[] = []
  for (let n = 2; n <= maxCards; n++) up.push(n)
  return [...down, ...up]
}

/** Score one player's result for a hand, given the configured rules. */
export function scoreHandForPlayer(
  bid: number,
  tricks: number,
  rules: ScoringRules,
): number {
  const made = bid === tricks
  if (made) {
    return tricks * rules.pointsPerTrick + rules.bonusForMakingBid
  }
  if (rules.missPenalty === 'flat-minus-ten') return -10
  // 'tricks-only': just count tricks taken, no bonus, no penalty.
  return tricks * rules.pointsPerTrick
}

/** Total score per player across all finalized hands. */
export function totalsByPlayer(
  players: Player[],
  hands: HandResult[],
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const p of players) totals[p.id] = 0
  for (const h of hands) {
    if (!h.finalized) continue
    for (const p of players) {
      totals[p.id] = (totals[p.id] ?? 0) + (h.scores[p.id] ?? 0)
    }
  }
  return totals
}

/**
 * Standard "competition" ranking by total score, descending (rank 1 = most
 * points). Tied players share the same rank and the following rank is
 * skipped — i.e. 1, 2, 2, 4 — which is the most natural reading for a
 * card-game leaderboard.
 */
export function ranksByPlayer(
  totals: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(totals)
  const sorted = [...entries].sort((a, b) => b[1] - a[1])
  const ranks: Record<string, number> = {}
  let lastScore: number | null = null
  let lastRank = 0
  sorted.forEach(([id, score], i) => {
    if (lastScore === null || score !== lastScore) {
      lastRank = i + 1
      lastScore = score
    }
    ranks[id] = lastRank
  })
  return ranks
}

/**
 * Bidding order for a hand: starts with player to the dealer's left,
 * ends with the dealer. Returned as an array of player ids.
 */
export function biddingOrder(players: Player[], dealerIndex: number): string[] {
  const n = players.length
  const order: string[] = []
  for (let i = 1; i <= n; i++) {
    const idx = (dealerIndex + i) % n
    const p = players[idx]
    if (p) order.push(p.id)
  }
  return order
}

/**
 * Whether `candidateBid` is forbidden for the dealer by the hook rule.
 * `otherBids` is the sum of bids already placed by non-dealer players this hand.
 */
export function isDealerBidForbidden(
  candidateBid: number,
  otherBidsSum: number,
  handSize: number,
  rules: ScoringRules,
): boolean {
  if (!rules.enforceDealerHook) return false
  return otherBidsSum + candidateBid === handSize
}
