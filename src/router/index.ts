import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/configure',
      name: 'configure',
      component: () => import('@/views/ConfigureView.vue'),
    },
    {
      path: '/score/:id',
      name: 'score',
      component: () => import('@/views/ScoreView.vue'),
      props: true,
    },
  ],
})

export default router

