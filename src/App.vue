<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title
        style="cursor: pointer"
        @click="router.push({ name: 'home' })"
      >
        Up and Down the River
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container>
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>

