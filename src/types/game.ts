/**
 * Domain types for the "Up and Down the River" scoring app.
 *
 * Hand progression: deal `maxCards` down to 1, then back up to `maxCards`.
 * Dealer rotates one player to the left each hand.
 */

export type MissPenaltyMode = 'tricks-only' | 'flat-minus-ten'

export interface ScoringRules {
  /** Largest hand size; deal goes maxCards -> 1 -> maxCards. */
  maxCards: number
  /** Points per trick taken (whether bid was made or not, unless overridden by penalty). */
  pointsPerTrick: number
  /** Bonus added when a player's tricks-taken === bid. */
  bonusForMakingBid: number
  /** How missed bids are scored. */
  missPenalty: MissPenaltyMode
  /** Dealer is forbidden to bid such that sum(bids) === handSize ("hook rule"). */
  enforceDealerHook: boolean
}

export interface Player {
  id: string
  name: string
}

/**
 * The three sub-phases a hand cycles through on the score page:
 *   bid   – players are bidding around the table
 *   play  – bidding is done, the hand is being played at the table
 *   tricks – recording the tricks taken by each player
 */
export type HandPhase = 'bid' | 'play' | 'tricks'

export interface HandResult {
  /** How many cards each player was dealt this hand. */
  handSize: number
  /** Index into `players` of the dealer for this hand. */
  dealerIndex: number
  /** Bid by player id; populated during bidding phase. */
  bids: Record<string, number>
  /** Tricks taken by player id; populated during trick-recording phase. */
  tricks: Record<string, number>
  /** Score earned this hand by player id (computed when the hand is finalized). */
  scores: Record<string, number>
  /** Whether tricks and per-hand scores have been finalized. */
  finalized: boolean
  /** Current sub-phase of this hand on the score page. */
  currentPhase: HandPhase
  /**
   * How many bids have been placed so far in this hand (advances 0..players.length
   * as players bid). Persisted so a refresh / "Continue" lands on the right step.
   */
  bidStep: number
  /**
   * True once a finalized hand has been hand-edited after the fact via the
   * "Edit hand" modal on the score page. Drives an audit indicator in the
   * Hands-played history table. Optional so existing persisted games migrate
   * silently (undefined === never edited).
   */
  editedAfterFinalize?: boolean
}

export type GameStatus = 'in-progress' | 'complete'

export interface Game {
  id: string
  /** ISO timestamp the game was created. */
  createdAt: string
  /** ISO timestamp the game was completed (set when status flips to 'complete'). */
  completedAt?: string
  rules: ScoringRules
  players: Player[]
  hands: HandResult[]
  /** Index of the hand currently being played. */
  currentHandIndex: number
  status: GameStatus
}
