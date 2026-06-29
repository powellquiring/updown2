<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGamesStore } from '@/stores/games'
import { totalsByPlayer } from '@/lib/scoring'

const router = useRouter()
const store = useGamesStore()

const games = computed(() => store.sortedGames)

function newBlankGame() {
  router.push({ name: 'configure' })
}

function continueGame(id: string) {
  router.push({ name: 'score', params: { id } })
}

function newGameFromExisting(id: string) {
  router.push({ name: 'configure', query: { from: id } })
}

function remove(id: string) {
  if (confirm('Delete this game permanently?')) store.deleteGame(id)
}

function defaultAction(id: string) {
  const g = store.gameById(id)
  if (!g) return
  if (g.status === 'complete') {
    newGameFromExisting(id)
  } else {
    continueGame(id)
  }
}

function leader(gameId: string): string {
  const g = store.gameById(gameId)
  if (!g) return '—'
  const totals = totalsByPlayer(g.players, g.hands)
  let bestId = ''
  let best = Number.NEGATIVE_INFINITY
  for (const p of g.players) {
    const s = totals[p.id] ?? 0
    if (s > best) {
      best = s
      bestId = p.id
    }
  }
  const winner = g.players.find((p) => p.id === bestId)
  return winner ? `${winner.name} (${best})` : '—'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="d-flex align-center mb-6">
    <h1 class="text-h4">Game history</h1>
    <v-spacer />
    <v-btn color="primary" prepend-icon="mdi-plus" @click="newBlankGame">
      New game
    </v-btn>
  </div>

  <v-alert
    v-if="games.length === 0"
    type="info"
    variant="tonal"
    text="No games yet. Click 'New game' to start one."
  />

  <v-list v-else lines="two">
    <v-list-item
      v-for="g in games"
      :key="g.id"
      :title="g.players.map((p) => p.name).join(', ') || '(no players)'"
      :subtitle="`${fmtDate(g.createdAt)} • ${g.status === 'complete' ? 'Complete' : 'In progress'} • Leader: ${leader(g.id)}`"
      @click="defaultAction(g.id)"
    >
      <template #append>
        <div class="d-flex align-center ga-2" @click.stop>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            aria-label="Delete game"
            @click="remove(g.id)"
          />
          <template v-if="g.status === 'complete'">
            <!-- Complete: default = New game; secondary = View -->
            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-eye"
              @click="continueGame(g.id)"
            >
              View
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="mdi-plus"
              @click="newGameFromExisting(g.id)"
            >
              New game
            </v-btn>
          </template>
          <template v-else>
            <!-- In progress: default = Continue; secondary = New game -->
            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-plus"
              @click="newGameFromExisting(g.id)"
            >
              New game
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="mdi-play"
              @click="continueGame(g.id)"
            >
              Continue
            </v-btn>
          </template>
        </div>
      </template>
    </v-list-item>
  </v-list>
</template>
