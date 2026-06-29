import { defineStore } from 'pinia'
import type {
  Game,
  HandPhase,
  HandResult,
  Player,
  ScoringRules,
} from '@/types/game'
import { handSizeSequence, scoreHandForPlayer } from '@/lib/scoring'

export const DEFAULT_RULES: ScoringRules = {
  maxCards: 2,
  pointsPerTrick: 1,
  bonusForMakingBid: 10,
  missPenalty: 'tricks-only',
  enforceDealerHook: true,
}

function uid(): string {
  // Good-enough id for a localStorage-backed prototype.
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  )
}

function emptyByPlayer(players: Player[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const p of players) r[p.id] = 0
  return r
}

function buildHands(players: Player[], rules: ScoringRules): HandResult[] {
  const sizes = handSizeSequence(rules.maxCards)
  return sizes.map((size, i) => ({
    handSize: size,
    dealerIndex: players.length === 0 ? 0 : i % players.length,
    bids: emptyByPlayer(players),
    tricks: emptyByPlayer(players),
    scores: emptyByPlayer(players),
    finalized: false,
    currentPhase: 'bid' as HandPhase,
    bidStep: 0,
  }))
}

interface State {
  games: Game[]
}

export const useGamesStore = defineStore('games', {
  state: (): State => ({ games: [] }),

  getters: {
    /** Newest first. */
    sortedGames(state): Game[] {
      return [...state.games].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )
    },
    gameById: (state) => (id: string) => {
      const g = state.games.find((g) => g.id === id)
      if (!g) return undefined
      // Lazy migration: older persisted games (pre-PLAY-phase) may be missing
      // `currentPhase` and `bidStep` on each hand. Backfill sane defaults so
      // those games keep working without forcing the user to clear storage.
      for (const h of g.hands) {
        if (h.currentPhase === undefined) {
          h.currentPhase = h.finalized ? 'tricks' : 'bid'
        }
        if (h.bidStep === undefined) h.bidStep = 0
      }
      return g
    },
  },

  actions: {
    createGame(playerNames: string[], rules: ScoringRules): Game {
      const players: Player[] = playerNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((name) => ({ id: uid(), name }))

      const game: Game = {
        id: uid(),
        createdAt: new Date().toISOString(),
        rules: { ...rules },
        players,
        hands: buildHands(players, rules),
        currentHandIndex: 0,
        status: 'in-progress',
      }
      this.games.push(game)
      return game
    },

    deleteGame(id: string) {
      this.games = this.games.filter((g) => g.id !== id)
    },

    /**
     * Record a bid for the given player on the current hand and advance
     * the bid pointer. When every player has bid, the hand auto-transitions
     * to the PLAY phase.
     */
    setBid(gameId: string, playerId: string, bid: number) {
      const game = this.games.find((g) => g.id === gameId)
      if (!game) return
      const hand = game.hands[game.currentHandIndex]
      if (!hand || hand.finalized || hand.currentPhase !== 'bid') return
      hand.bids[playerId] = bid
      hand.bidStep += 1
      if (hand.bidStep >= game.players.length) {
        hand.currentPhase = 'play'
      }
    },

    /** Rewind the bid pointer by one (clears that player's bid back to 0). */
    undoLastBid(gameId: string) {
      const game = this.games.find((g) => g.id === gameId)
      if (!game) return
      const hand = game.hands[game.currentHandIndex]
      if (!hand || hand.finalized) return
      if (hand.currentPhase === 'play') {
        // Allow undo to walk back out of PLAY into BID.
        hand.currentPhase = 'bid'
      }
      if (hand.currentPhase !== 'bid' || hand.bidStep === 0) return
      hand.bidStep -= 1
      // Clear the just-undone bid using the bidding order.
      const n = game.players.length
      const undoneIdx = (hand.dealerIndex + 1 + hand.bidStep) % n
      const p = game.players[undoneIdx]
      if (p) hand.bids[p.id] = 0
    },

    /**
     * Edit the bids and tricks of an already-finalized hand. Rescore that
     * hand under the current rules and mark it as edited so the UI can show
     * an audit indicator. Refuses to write data that violates the
     * sum(tricks) === handSize invariant (defense in depth; the UI also
     * enforces this before calling).
     */
    editFinalizedHand(
      gameId: string,
      handIndex: number,
      bids: Record<string, number>,
      tricks: Record<string, number>,
    ) {
      const game = this.games.find((g) => g.id === gameId)
      if (!game) return
      const hand = game.hands[handIndex]
      if (!hand || !hand.finalized) return

      // Validate trick total matches hand size.
      let trickSum = 0
      for (const p of game.players) trickSum += tricks[p.id] ?? 0
      if (trickSum !== hand.handSize) return

      // Validate every bid is within range; clamp defensively.
      for (const p of game.players) {
        const b = Math.max(0, Math.min(hand.handSize, bids[p.id] ?? 0))
        const t = Math.max(0, Math.min(hand.handSize, tricks[p.id] ?? 0))
        hand.bids[p.id] = b
        hand.tricks[p.id] = t
        hand.scores[p.id] = scoreHandForPlayer(b, t, game.rules)
      }
      hand.editedAfterFinalize = true
    },

    /** Explicitly move the current hand to a new sub-phase. */
    setPhase(gameId: string, phase: HandPhase) {
      const game = this.games.find((g) => g.id === gameId)
      if (!game) return
      const hand = game.hands[game.currentHandIndex]
      if (!hand || hand.finalized) return
      hand.currentPhase = phase
    },

    /**
     * Finalize the current hand: store tricks, compute per-player scores,
     * advance to the next hand or mark the game complete.
     */
    finalizeHand(gameId: string, tricks: Record<string, number>) {
      const game = this.games.find((g) => g.id === gameId)
      if (!game) return
      const hand = game.hands[game.currentHandIndex]
      if (!hand || hand.finalized) return

      for (const p of game.players) {
        const t = tricks[p.id] ?? 0
        const b = hand.bids[p.id] ?? 0
        hand.tricks[p.id] = t
        hand.scores[p.id] = scoreHandForPlayer(b, t, game.rules)
      }
      hand.finalized = true

      if (game.currentHandIndex + 1 >= game.hands.length) {
        game.status = 'complete'
        game.completedAt = new Date().toISOString()
      } else {
        game.currentHandIndex += 1
        const next = game.hands[game.currentHandIndex]
        if (next) {
          next.currentPhase = 'bid'
          next.bidStep = 0
        }
      }
    },

    /**
     * Apply an edit made on the configure page to an in-progress game.
     *
     * Players already finalized in past hands are kept (their finalized hand
     * results are NOT rescored). For the current and all future hands we
     * rebuild the hand list from the new player order + new rules. If only
     * cosmetic rule fields change (no maxCards or player change), past hands
     * remain untouched and the remaining hands keep their bids/tricks/phase
     * where possible.
     */
    updateConfig(
      gameId: string,
      newPlayerNames: string[],
      newRules: ScoringRules,
    ) {
      const game = this.games.find((g) => g.id === gameId)
      if (!game || game.status === 'complete') return

      const cleanedNames = newPlayerNames
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
      if (cleanedNames.length < 2) return

      // Match new names to existing player ids by position so seat
      // reordering preserves identity (and therefore past-hand scoring).
      const oldPlayers = game.players
      const newPlayers: Player[] = cleanedNames.map((name, i) => {
        const existing = oldPlayers[i]
        if (existing) return { ...existing, name }
        return { id: uid(), name }
      })

      const playerCountChanged = newPlayers.length !== oldPlayers.length
      const maxCardsChanged = newRules.maxCards !== game.rules.maxCards

      game.players = newPlayers
      game.rules = { ...newRules }

      if (playerCountChanged || maxCardsChanged) {
        // Structural change: rebuild the unplayed remainder. Past finalized
        // hands stay as historical record (with rescored per-hand scores
        // under the new rules; see rescore loop below).
        const pastFinalized = game.hands.filter((h) => h.finalized)
        const futureHands = buildHands(newPlayers, newRules).slice(
          pastFinalized.length,
        )
        game.hands = [...pastFinalized, ...futureHands]
        game.currentHandIndex = Math.min(
          pastFinalized.length,
          game.hands.length - 1,
        )
        if (game.currentHandIndex < 0) game.currentHandIndex = 0
      } else {
        // Same shape: just make sure every unfinalized hand has an entry
        // for every (possibly renamed) player. Names changed, ids did not,
        // so the bids/tricks maps still key correctly.
        for (const h of game.hands) {
          if (h.finalized) continue
          for (const p of newPlayers) {
            if (!(p.id in h.bids)) h.bids[p.id] = 0
            if (!(p.id in h.tricks)) h.tricks[p.id] = 0
            if (!(p.id in h.scores)) h.scores[p.id] = 0
          }
        }
      }

      // Recalculate scores of every already-finalized hand under the new
      // rules. (Per the spec: "After resuming the game recalculate the
      // scores based on the new rules.") Bids and tricks are kept as
      // historical record; only the per-hand score derived from them is
      // recomputed.
      for (const h of game.hands) {
        if (!h.finalized) continue
        for (const p of newPlayers) {
          const b = h.bids[p.id] ?? 0
          const t = h.tricks[p.id] ?? 0
          h.scores[p.id] = scoreHandForPlayer(b, t, newRules)
        }
      }
    },
  },

  persist: true,
})
