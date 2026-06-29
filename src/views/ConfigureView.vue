<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEFAULT_RULES, useGamesStore } from '@/stores/games'
import type { MissPenaltyMode, ScoringRules } from '@/types/game'

const router = useRouter()
const route = useRoute()
const store = useGamesStore()

/**
 * Three modes:
 *   - blank: brand-new game, no query params
 *   - copy:  ?from=<gameId>  – pre-fill from an existing game's players+rules
 *   - edit:  ?edit=<gameId>  – modify an in-progress game in place
 */
const fromId = computed(() =>
  typeof route.query.from === 'string' ? route.query.from : null,
)
const editId = computed(() =>
  typeof route.query.edit === 'string' ? route.query.edit : null,
)
const isEditing = computed(() => editId.value !== null)

const initialNames = (): string[] => {
  const sourceId = editId.value ?? fromId.value
  if (sourceId) {
    const g = store.gameById(sourceId)
    if (g) return g.players.map((p) => p.name)
  }
  return ['', '', '', '']
}

const initialRules = (): ScoringRules => {
  const sourceId = editId.value ?? fromId.value
  if (sourceId) {
    const g = store.gameById(sourceId)
    if (g) return { ...g.rules }
  }
  return { ...DEFAULT_RULES }
}

const playerNames = ref<string[]>(initialNames())
const rules = ref<ScoringRules>(initialRules())

const missPenaltyOptions: { title: string; value: MissPenaltyMode }[] = [
  { title: 'Tricks only (no bonus, no penalty)', value: 'tricks-only' },
  { title: 'Flat −10 for missing bid', value: 'flat-minus-ten' },
]

const primaryLabel = computed(() => (isEditing.value ? 'Resume game' : 'Start game'))

function addPlayer() {
  if (playerNames.value.length < 8) playerNames.value.push('')
}

function removePlayer(i: number) {
  if (playerNames.value.length > 2) playerNames.value.splice(i, 1)
}

function moveUp(i: number) {
  if (i <= 0) return
  const arr = playerNames.value
  const above = arr[i - 1] ?? ''
  const here = arr[i] ?? ''
  arr[i - 1] = here
  arr[i] = above
}

function moveDown(i: number) {
  if (i >= playerNames.value.length - 1) return
  moveUp(i + 1)
}

function canStart(): boolean {
  const cleaned = playerNames.value.map((n) => n.trim()).filter((n) => n.length > 0)
  return cleaned.length >= 2 && rules.value.maxCards >= 1
}

function start() {
  if (!canStart()) return
  if (isEditing.value && editId.value) {
    store.updateConfig(editId.value, playerNames.value, rules.value)
    router.push({ name: 'score', params: { id: editId.value } })
    return
  }
  const game = store.createGame(playerNames.value, rules.value)
  router.push({ name: 'score', params: { id: game.id } })
}

function cancel() {
  if (isEditing.value && editId.value) {
    router.push({ name: 'score', params: { id: editId.value } })
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<template>
  <div class="d-flex align-center mb-2">
    <h1 class="text-h4">Configure game</h1>
    <v-spacer />
    <v-btn color="primary" :disabled="!canStart()" @click="start">
      {{ primaryLabel }}
    </v-btn>
  </div>
  <p
    v-if="isEditing"
    class="text-caption text-medium-emphasis mb-4"
  >
    Editing in-progress game — changes will apply to the remaining hands.
  </p>
  <div v-else class="mb-4"></div>

  <v-card class="mb-6" title="Players">
    <v-card-text>
      <div
        v-for="(_, i) in playerNames"
        :key="i"
        class="d-flex align-center mb-2 ga-1"
      >
        <div class="d-flex flex-column">
          <v-btn
            icon="mdi-chevron-up"
            variant="text"
            size="x-small"
            :disabled="i === 0"
            aria-label="Move player up"
            @click="moveUp(i)"
          />
          <v-btn
            icon="mdi-chevron-down"
            variant="text"
            size="x-small"
            :disabled="i === playerNames.length - 1"
            aria-label="Move player down"
            @click="moveDown(i)"
          />
        </div>
        <v-chip size="small" class="mx-2" variant="tonal">
          Seat {{ i + 1 }}
        </v-chip>
        <v-text-field
          v-model="playerNames[i]"
          :label="`Player ${i + 1}`"
          hide-details
          density="compact"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="ml-2"
          :disabled="playerNames.length <= 2"
          aria-label="Remove player"
          @click="removePlayer(i)"
        />
      </div>
      <v-btn
        prepend-icon="mdi-plus"
        variant="tonal"
        :disabled="playerNames.length >= 8"
        @click="addPlayer"
      >
        Add player
      </v-btn>
    </v-card-text>
  </v-card>

  <v-card class="mb-6" title="Scoring rules">
    <v-card-text>
      <v-row>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="rules.maxCards"
            type="number"
            label="Max cards per hand (also starting/ending size)"
            min="1"
            max="13"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="rules.pointsPerTrick"
            type="number"
            label="Points per trick taken"
            min="0"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="rules.bonusForMakingBid"
            type="number"
            label="Bonus for making your exact bid"
            min="0"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-select
            v-model="rules.missPenalty"
            :items="missPenaltyOptions"
            label="Missed-bid penalty"
          />
        </v-col>
        <v-col cols="12">
          <v-switch
            v-model="rules.enforceDealerHook"
            color="primary"
            label="Enforce dealer hook (sum of bids ≠ hand size)"
            hide-details
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <div class="d-flex">
    <v-btn variant="text" @click="cancel">Cancel</v-btn>
    <v-spacer />
    <v-btn color="primary" :disabled="!canStart()" @click="start">
      {{ primaryLabel }}
    </v-btn>
  </div>
</template>
