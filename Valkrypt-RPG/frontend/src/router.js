import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue' 
import VerifyView from './views/VerifyView.vue'
import UserPage from './views/UserPage.vue'
import GameView from './views/GameView.vue'

const routes = [
  { 
    path: '/', 
    name: 'home', 
    component: HomeView 
  },
  { 
    path: '/login', 
    name: 'login', 
    component: LoginView 
  },
  { 
    path: '/register',
    name: 'register', 
    component: RegisterView 
  },
  { 
    path: '/verify', 
    name: 'verify', 
    component: VerifyView 
  },
  { 
    path: '/UserPage',
    name: 'userpage', 
    component: UserPage 
  },
  {
    path: '/game',
    name: 'game',
    component: GameView
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
