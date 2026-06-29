<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGamesStore } from '@/stores/games'
import {
  biddingOrder,
  isDealerBidForbidden,
  ranksByPlayer,
  totalsByPlayer,
} from '@/lib/scoring'
import type { Player } from '@/types/game'

const props = defineProps<{ id: string }>()

const router = useRouter()
const store = useGamesStore()

const game = computed(() => store.gameById(props.id))

/** Local trick draft for the current hand (persisted to store on Finalize). */
const tricksDraft = ref<Record<string, number>>({})
/**
 * Player whose trick stepper was most recently pressed during the TRICKS
 * phase. Drives the card-header name in that phase. Starts empty.
 */
const lastTrickPlayerId = ref<string | null>(null)

const currentHand = computed(() => {
  const g = game.value
  if (!g) return null
  return g.hands[g.currentHandIndex] ?? null
})

const biddingOrderIds = computed<string[]>(() => {
  const g = game.value
  const h = currentHand.value
  if (!g || !h) return []
  return biddingOrder(g.players, h.dealerIndex)
})

const dealer = computed(() => {
  const g = game.value
  const h = currentHand.value
  if (!g || !h) return null
  return g.players[h.dealerIndex] ?? null
})

const firstToPlay = computed<Player | null>(() => {
  const g = game.value
  const h = currentHand.value
  if (!g || !h) return null
  const idx = (h.dealerIndex + 1) % g.players.length
  return g.players[idx] ?? null
})

const currentBidder = computed<Player | null>(() => {
  const g = game.value
  const h = currentHand.value
  if (!g || !h || h.currentPhase !== 'bid') return null
  const pid = biddingOrderIds.value[h.bidStep]
  return g.players.find((p) => p.id === pid) ?? null
})

const otherBidsSum = computed(() => {
  const h = currentHand.value
  const g = game.value
  if (!h || !g || !dealer.value) return 0
  let sum = 0
  for (const pid of biddingOrderIds.value) {
    if (pid === dealer.value.id) continue
    sum += h.bids[pid] ?? 0
  }
  return sum
})

const totals = computed(() => {
  const g = game.value
  if (!g) return {} as Record<string, number>
  return totalsByPlayer(g.players, g.hands)
})

/** Player id with the highest total; used to highlight the leader. */
const leaderId = computed<string | null>(() => {
  const g = game.value
  if (!g) return null
  let bestId: string | null = null
  let best = Number.NEGATIVE_INFINITY
  for (const p of g.players) {
    const s = totals.value[p.id] ?? 0
    if (s > best) {
      best = s
      bestId = p.id
    }
  }
  return bestId
})

/** Map of player id -> rank (1 = highest total, ties share rank). */
const ranks = computed(() => ranksByPlayer(totals.value))

/**
 * TRICKS sub-phase: which player we're currently prompting for, as an
 * index into `tricksOrderIds`. When >= tricksOrderIds.length the trick
 * loop is done and the Finalize summary is shown.
 *
 * Player order during TRICKS is the same as bidding order (starts left of
 * dealer, ends with dealer) so dealer-hook surprises are revealed last.
 */
const trickStep = ref(0)
const tricksOrderIds = computed<string[]>(() => biddingOrderIds.value)
const currentTrickPlayer = computed<Player | null>(() => {
  const g = game.value
  const h = currentHand.value
  if (!g || !h || h.currentPhase !== 'tricks') return null
  const pid = tricksOrderIds.value[trickStep.value]
  if (!pid) return null
  return g.players.find((p) => p.id === pid) ?? null
})
const tricksDone = computed(
  () =>
    currentHand.value?.currentPhase === 'tricks' &&
    trickStep.value >= tricksOrderIds.value.length,
)

/** Name to show in the current-hand card header, by phase. */
const handHeaderName = computed<string>(() => {
  const h = currentHand.value
  if (!h) return ''
  if (h.currentPhase === 'bid') return currentBidder.value?.name ?? ''
  if (h.currentPhase === 'play') return firstToPlay.value?.name ?? ''
  // tricks: show the player we're currently prompting. Once the loop is
  // done the header falls back to empty so the summary area is the focus.
  if (tricksDone.value) return ''
  return currentTrickPlayer.value?.name ?? ''
})

const phaseChipLabel = computed<string>(() => {
  const h = currentHand.value
  if (!h) return ''
  switch (h.currentPhase) {
    case 'bid':
      return 'BID'
    case 'play':
      return 'PLAY'
    case 'tricks':
      return 'TRICKS'
    default:
      return ''
  }
})

function primeTricksDraftFromBids() {
  const g = game.value
  const h = currentHand.value
  if (!g || !h) return
  const draft: Record<string, number> = {}
  for (const p of g.players) draft[p.id] = h.bids[p.id] ?? 0
  tricksDraft.value = draft
}

/** Reset transient state when the active hand changes. */
watch(
  () => game.value?.currentHandIndex,
  () => {
    tricksDraft.value = {}
    lastTrickPlayerId.value = null
    trickStep.value = 0
    primeTricksDraftFromBids()
  },
  { immediate: true },
)

/** When the phase shifts, refresh the trick draft so defaults track bids. */
watch(
  () => currentHand.value?.currentPhase,
  (phase) => {
    if (phase === 'tricks') {
      primeTricksDraftFromBids()
      trickStep.value = 0
      lastTrickPlayerId.value = null
    }
    if (phase === 'bid' || phase === 'play') {
      lastTrickPlayerId.value = null
      trickStep.value = 0
    }
  },
)

function bidOptions(): number[] {
  const g = game.value
  const h = currentHand.value
  if (!g || !h || !currentBidder.value) return []
  const isDealer = currentBidder.value.id === dealer.value?.id
  const opts: number[] = []
  for (let n = 0; n <= h.handSize; n++) {
    if (isDealer && isDealerBidForbidden(n, otherBidsSum.value, h.handSize, g.rules)) {
      continue
    }
    opts.push(n)
  }
  return opts
}

function placeBid(n: number) {
  const g = game.value
  const bidder = currentBidder.value
  if (!g || !bidder) return
  store.setBid(g.id, bidder.id, n)
}

function undoLastBid() {
  const g = game.value
  if (!g) return
  store.undoLastBid(g.id)
}

function donePlaying() {
  const g = game.value
  if (!g) return
  store.setPhase(g.id, 'tricks')
}

function incTrick(pid: string, delta: number) {
  const h = currentHand.value
  if (!h) return
  const current = tricksDraft.value[pid] ?? 0
  const next = Math.max(0, Math.min(h.handSize, current + delta))
  tricksDraft.value[pid] = next
  lastTrickPlayerId.value = pid
}

/** Advance to the next player to enter tricks (or to the Finalize summary). */
function nextTrick() {
  trickStep.value += 1
}

/** Go back to the previous player to revise their tricks. */
function prevTrick() {
  if (trickStep.value === 0) return
  trickStep.value -= 1
}

const tricksSum = computed(() => {
  const g = game.value
  if (!g) return 0
  let s = 0
  for (const p of g.players) s += tricksDraft.value[p.id] ?? 0
  return s
})

const tricksMatch = computed(() => {
  const h = currentHand.value
  if (!h) return false
  return tricksSum.value === h.handSize
})

function finalize() {
  const g = game.value
  if (!g || !tricksMatch.value) return
  const tricks: Record<string, number> = {}
  for (const p of g.players) tricks[p.id] = tricksDraft.value[p.id] ?? 0
  store.finalizeHand(g.id, tricks)
}

function bidsRecap(): string {
  const g = game.value
  const h = currentHand.value
  if (!g || !h) return ''
  return biddingOrderIds.value
    .map((pid, i) => {
      const p = g.players.find((pl) => pl.id === pid)
      const name = p?.name ?? '?'
      if (h.currentPhase === 'bid' && i >= h.bidStep) return `${name} —`
      return `${name} ${h.bids[pid] ?? 0}`
    })
    .join(' · ')
}

function editConfig() {
  const g = game.value
  if (!g) return
  router.push({ name: 'configure', query: { edit: g.id } })
}

function newGameSameRules() {
  const g = game.value
  if (!g) return
  router.push({ name: 'configure', query: { from: g.id } })
}

/* -------------------------------------------------------------------------
 * Per-hand edit modal (Pattern B).
 * Opens from the pencil icon on a finalized row in the Hands-played table.
 * ------------------------------------------------------------------------- */

const editHandIndex = ref<number | null>(null)
const editBids = ref<Record<string, number>>({})
const editTricks = ref<Record<string, number>>({})

const editHand = computed(() => {
  const g = game.value
  if (!g || editHandIndex.value === null) return null
  return g.hands[editHandIndex.value] ?? null
})

const editDealer = computed<Player | null>(() => {
  const g = game.value
  const h = editHand.value
  if (!g || !h) return null
  return g.players[h.dealerIndex] ?? null
})

const editTricksSum = computed(() => {
  const g = game.value
  if (!g) return 0
  let s = 0
  for (const p of g.players) s += editTricks.value[p.id] ?? 0
  return s
})

const editBidsSum = computed(() => {
  const g = game.value
  if (!g) return 0
  let s = 0
  for (const p of g.players) s += editBids.value[p.id] ?? 0
  return s
})

const editTricksValid = computed(() => {
  const h = editHand.value
  if (!h) return false
  return editTricksSum.value === h.handSize
})

const editHookViolated = computed(() => {
  const g = game.value
  const h = editHand.value
  if (!g || !h) return false
  return g.rules.enforceDealerHook && editBidsSum.value === h.handSize
})

/** Per-player previewed score under the current rules and proposed edits. */
const editScorePreview = computed<Record<string, number>>(() => {
  const g = game.value
  const h = editHand.value
  if (!g || !h) return {}
  const out: Record<string, number> = {}
  for (const p of g.players) {
    const b = editBids.value[p.id] ?? 0
    const t = editTricks.value[p.id] ?? 0
    // Inline copy of scoreHandForPlayer's logic to avoid a second import.
    if (b === t) {
      out[p.id] = t * g.rules.pointsPerTrick + g.rules.bonusForMakingBid
    } else if (g.rules.missPenalty === 'flat-minus-ten') {
      out[p.id] = -10
    } else {
      out[p.id] = t * g.rules.pointsPerTrick
    }
  }
  return out
})

function openEditHand(i: number) {
  const g = game.value
  if (!g) return
  const h = g.hands[i]
  if (!h || !h.finalized) return
  // Seed local edit state with current values.
  const bidsCopy: Record<string, number> = {}
  const tricksCopy: Record<string, number> = {}
  for (const p of g.players) {
    bidsCopy[p.id] = h.bids[p.id] ?? 0
    tricksCopy[p.id] = h.tricks[p.id] ?? 0
  }
  editBids.value = bidsCopy
  editTricks.value = tricksCopy
  editHandIndex.value = i
}

function closeEditHand() {
  editHandIndex.value = null
}

function incEditBid(pid: string, delta: number) {
  const h = editHand.value
  if (!h) return
  const cur = editBids.value[pid] ?? 0
  editBids.value[pid] = Math.max(0, Math.min(h.handSize, cur + delta))
}

function incEditTrick(pid: string, delta: number) {
  const h = editHand.value
  if (!h) return
  const cur = editTricks.value[pid] ?? 0
  editTricks.value[pid] = Math.max(0, Math.min(h.handSize, cur + delta))
}

function saveEditHand() {
  const g = game.value
  if (!g || editHandIndex.value === null || !editTricksValid.value) return
  store.editFinalizedHand(
    g.id,
    editHandIndex.value,
    editBids.value,
    editTricks.value,
  )
  closeEditHand()
}
</script>

<template>
  <div v-if="!game">
    <v-alert type="error" text="Game not found." />
    <v-btn class="mt-4" @click="router.push({ name: 'home' })">Back</v-btn>
  </div>

  <div v-else>
    <!-- Page header row -->
    <div class="d-flex align-center mb-4 ga-2 flex-wrap">
      <h1 class="text-h4">
        {{ game.status === 'complete' ? 'Final scores' : 'Score game' }}
      </h1>
      <v-btn
        v-if="game.status !== 'complete'"
        variant="text"
        size="small"
        prepend-icon="mdi-pencil"
        @click="editConfig"
      >
        Edit configuration
      </v-btn>
      <v-spacer />
      <v-chip
        v-if="game.status !== 'complete' && currentHand"
        color="primary"
        variant="tonal"
      >
        Hand: {{ game.currentHandIndex + 1 }}/{{ game.hands.length }}
        &nbsp;Cards: {{ currentHand.handSize }}
      </v-chip>
    </div>

    <!-- Standings -->
    <v-card class="mb-6" title="Standings">
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-center" style="width: 4em">Rank</th>
            <th>Player</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in game.players"
            :key="p.id"
            :class="{ 'font-weight-bold': leaderId === p.id }"
          >
            <td class="text-center">{{ ranks[p.id] ?? '—' }}</td>
            <td>
              <v-icon
                v-if="leaderId === p.id"
                size="x-small"
                color="amber-darken-2"
                class="mr-1"
                icon="mdi-trophy"
              />
              {{ p.name }}
              <v-chip
                v-if="dealer && dealer.id === p.id && game.status !== 'complete'"
                size="x-small"
                color="primary"
                class="ml-2"
              >
                Dealer
              </v-chip>
            </td>
            <td class="text-right">{{ totals[p.id] ?? 0 }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- Current hand card -->
    <v-card v-if="currentHand && game.status !== 'complete'" class="mb-6">
      <v-card-title class="d-flex align-center ga-2">
        <span>{{ handHeaderName }}</span>
        <v-spacer />
        <v-chip
          :color="
            currentHand.currentPhase === 'bid'
              ? 'primary'
              : currentHand.currentPhase === 'play'
                ? 'amber-darken-2'
                : 'success'
          "
          variant="flat"
          size="small"
        >
          {{ phaseChipLabel }}
        </v-chip>
      </v-card-title>

      <v-card-text>
        <!-- BID sub-phase -->
        <div v-if="currentHand.currentPhase === 'bid'">
          <p
            v-if="
              currentBidder &&
              dealer &&
              currentBidder.id === dealer.id &&
              game.rules.enforceDealerHook
            "
            class="text-caption text-medium-emphasis mb-3"
          >
            (dealer hook: can't bid {{ currentHand.handSize - otherBidsSum }})
          </p>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-for="n in bidOptions()"
              :key="n"
              color="primary"
              variant="tonal"
              size="large"
              @click="placeBid(n)"
            >
              {{ n }}
            </v-btn>
          </div>
          <v-btn
            v-if="currentHand.bidStep > 0"
            class="mt-4"
            variant="text"
            prepend-icon="mdi-undo"
            @click="undoLastBid"
          >
            Undo last bid
          </v-btn>
          <p class="text-caption text-medium-emphasis mt-4 mb-0">
            {{ bidsRecap() }}
          </p>
        </div>

        <!-- PLAY sub-phase -->
        <div v-else-if="currentHand.currentPhase === 'play'">
          <p class="mb-3">
            Hand is being played. Tap <strong>Done playing</strong> when
            the hand is over.
          </p>
          <p class="text-caption text-medium-emphasis mb-4">
            Bids: {{ bidsRecap() }}
          </p>
          <div class="d-flex ga-2">
            <v-btn
              variant="text"
              prepend-icon="mdi-undo"
              @click="undoLastBid"
            >
              Back to bidding
            </v-btn>
            <v-spacer />
            <v-btn color="primary" prepend-icon="mdi-check" @click="donePlaying">
              Done playing
            </v-btn>
          </div>
        </div>

        <!-- TRICKS sub-phase: one player at a time -->
        <div v-else>
          <!-- Per-player prompt (well-spread to avoid fat-finger mistakes) -->
          <div v-if="currentTrickPlayer">
            <p class="text-caption text-medium-emphasis mb-2">
              Bid {{ currentHand.bids[currentTrickPlayer.id] ?? 0 }} —
              record tricks taken
              ({{ trickStep + 1 }} of {{ tricksOrderIds.length }})
            </p>
            <div class="d-flex align-center justify-center ga-6 my-6 flex-wrap">
              <v-btn
                icon="mdi-minus"
                color="primary"
                variant="tonal"
                size="x-large"
                @click="incTrick(currentTrickPlayer.id, -1)"
              />
              <span
                :class="{
                  'text-red':
                    (tricksDraft[currentTrickPlayer.id] ?? 0) !==
                    (currentHand.bids[currentTrickPlayer.id] ?? 0),
                }"
                class="text-h2 font-weight-bold"
                style="min-width: 2em; text-align: center"
              >
                {{ tricksDraft[currentTrickPlayer.id] ?? 0 }}
              </span>
              <v-btn
                icon="mdi-plus"
                color="primary"
                variant="tonal"
                size="x-large"
                @click="incTrick(currentTrickPlayer.id, 1)"
              />
            </div>
            <div class="d-flex align-center mt-4">
              <v-btn
                variant="text"
                prepend-icon="mdi-arrow-left"
                :disabled="trickStep === 0"
                @click="prevTrick"
              >
                Back
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                size="large"
                append-icon="mdi-arrow-right"
                @click="nextTrick"
              >
                Next
              </v-btn>
            </div>
          </div>

          <!-- After every player has been prompted: summary & finalize -->
          <div v-else>
            <p class="mb-3">All players entered. Review and finalize:</p>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>Player</th>
                  <th class="text-right">Bid</th>
                  <th class="text-right">Tricks</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in game.players" :key="p.id">
                  <td>{{ p.name }}</td>
                  <td class="text-right">{{ currentHand.bids[p.id] ?? 0 }}</td>
                  <td
                    class="text-right"
                    :class="{
                      'text-red':
                        (tricksDraft[p.id] ?? 0) !== (currentHand.bids[p.id] ?? 0),
                    }"
                  >
                    {{ tricksDraft[p.id] ?? 0 }}
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-alert
              :type="tricksMatch ? 'success' : 'warning'"
              variant="tonal"
              density="compact"
              class="mt-4"
              :text="`Tricks recorded: ${tricksSum} / ${currentHand.handSize}`"
            />
            <div class="d-flex mt-4">
              <v-btn
                variant="text"
                prepend-icon="mdi-arrow-left"
                @click="prevTrick"
              >
                Back to last player
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                :disabled="!tricksMatch"
                @click="finalize"
              >
                Finalize hand
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>


    <!-- Hands played -->
    <v-card title="Hands played">
      <v-table density="compact">
        <thead>
          <tr>
            <th>#</th>
            <th>Cards</th>
            <th v-for="p in game.players" :key="p.id">{{ p.name }}</th>
            <th class="text-center" style="width: 3em"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(h, i) in game.hands"
            :key="i"
            :class="{
              'text-medium-emphasis': !h.finalized && i !== game.currentHandIndex,
              'bg-blue-grey-lighten-5': i === game.currentHandIndex && game.status !== 'complete',
            }"
          >
            <td>
              {{ i + 1 }}
              <v-icon
                v-if="h.editedAfterFinalize"
                icon="mdi-pencil-outline"
                size="x-small"
                class="ml-1 text-medium-emphasis"
                title="Edited after finalization"
              />
            </td>
            <td>{{ h.handSize }}</td>
            <td v-for="p in game.players" :key="p.id">
              <!-- Finalized: full bid / tricks (score) -->
              <template v-if="h.finalized">
                {{ h.bids[p.id] ?? 0 }} /
                <span
                  :class="{
                    'text-red': (h.tricks[p.id] ?? 0) !== (h.bids[p.id] ?? 0),
                  }"
                >{{ h.tricks[p.id] ?? 0 }}</span>
                <strong>({{ h.scores[p.id] ?? 0 }})</strong>
              </template>

              <!-- Current hand: show bids and (provisional) tricks as they're entered -->
              <template v-else-if="i === game.currentHandIndex">
                <template v-if="biddingOrderIds.indexOf(p.id) < h.bidStep">
                  {{ h.bids[p.id] ?? 0 }}
                </template>
                <template v-else>—</template>
                <template
                  v-if="
                    h.currentPhase === 'tricks' &&
                    tricksOrderIds.indexOf(p.id) < trickStep
                  "
                >
                  /
                  <span
                    :class="{
                      'text-red':
                        (tricksDraft[p.id] ?? 0) !== (h.bids[p.id] ?? 0),
                    }"
                  >{{ tricksDraft[p.id] ?? 0 }}</span>
                </template>
              </template>

              <!-- Future hands -->
              <template v-else>—</template>
            </td>
            <td class="text-center">
              <v-btn
                v-if="h.finalized"
                icon="mdi-pencil"
                variant="text"
                size="x-small"
                aria-label="Edit this hand"
                @click="openEditHand(i)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- Completion CTA -->
    <div
      v-if="game.status === 'complete'"
      class="d-flex justify-end mt-6"
    >
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="newGameSameRules"
      >
        New game with same rules
      </v-btn>
    </div>

    <!-- Edit-hand modal (Pattern B) -->
    <v-dialog
      :model-value="editHandIndex !== null"
      max-width="560"
      persistent
      @update:model-value="(v) => { if (!v) closeEditHand() }"
    >
      <v-card v-if="editHand">
        <v-card-title>
          Edit hand {{ (editHandIndex ?? 0) + 1 }} — {{ editHand.handSize }}
          card{{ editHand.handSize === 1 ? '' : 's' }}
        </v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-3">
            Dealer: <strong>{{ editDealer?.name ?? '?' }}</strong>
          </p>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Player</th>
                <th class="text-center">Bid</th>
                <th class="text-center">Tricks</th>
                <th class="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in game.players" :key="p.id">
                <td>{{ p.name }}</td>
                <td>
                  <div class="d-flex align-center justify-center ga-2">
                    <v-btn
                      icon="mdi-minus"
                      size="x-small"
                      variant="tonal"
                      @click="incEditBid(p.id, -1)"
                    />
                    <span style="min-width: 1.5em; text-align: center">
                      {{ editBids[p.id] ?? 0 }}
                    </span>
                    <v-btn
                      icon="mdi-plus"
                      size="x-small"
                      variant="tonal"
                      @click="incEditBid(p.id, 1)"
                    />
                  </div>
                </td>
                <td>
                  <div class="d-flex align-center justify-center ga-2">
                    <v-btn
                      icon="mdi-minus"
                      size="x-small"
                      variant="tonal"
                      @click="incEditTrick(p.id, -1)"
                    />
                    <span
                      :class="{
                        'text-red':
                          (editTricks[p.id] ?? 0) !== (editBids[p.id] ?? 0),
                      }"
                      style="min-width: 1.5em; text-align: center"
                    >
                      {{ editTricks[p.id] ?? 0 }}
                    </span>
                    <v-btn
                      icon="mdi-plus"
                      size="x-small"
                      variant="tonal"
                      @click="incEditTrick(p.id, 1)"
                    />
                  </div>
                </td>
                <td class="text-right font-weight-bold">
                  {{ editScorePreview[p.id] ?? 0 }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="d-flex align-center ga-2 mt-4 flex-wrap">
            <v-chip
              :color="editTricksValid ? 'success' : 'warning'"
              variant="tonal"
              size="small"
            >
              Tricks: {{ editTricksSum }} / {{ editHand.handSize }}
              {{ editTricksValid ? '✓' : '— must equal ' + editHand.handSize }}
            </v-chip>
            <v-chip
              v-if="game.rules.enforceDealerHook"
              :color="editHookViolated ? 'error' : 'default'"
              variant="tonal"
              size="small"
            >
              Bids sum: {{ editBidsSum }} / {{ editHand.handSize }}
              <span v-if="editHookViolated">&nbsp;(violates dealer hook)</span>
            </v-chip>
          </div>
          <p
            v-if="editHookViolated"
            class="text-caption text-medium-emphasis mt-2 mb-0"
          >
            Note: the dealer-hook rule is enforced at bid time. A finalized
            hand can still be saved with a hook-matching bid sum (e.g. to
            correct a typo to the values that were actually played).
          </p>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="closeEditHand">Cancel</v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            :disabled="!editTricksValid"
            @click="saveEditHand"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>


