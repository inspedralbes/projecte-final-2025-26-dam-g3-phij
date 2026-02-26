import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue' 
import VerifyView from './views/VerifyView.vue'
import UserPage from './views/UserPage.vue'
import GameView from './views/GameView.vue'
import CharacterSelect from './views/CharacterSelect.vue'
import RoomLobby from './views/RoomLobby.vue'
import GameRoom from './views/GameRoom.vue'

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
    path: '/userpage', 
    name: 'userpage', 
    component: UserPage 
  },
  {
    path: '/select',
    name: 'character-select',
    component: CharacterSelect
  },
  {
    path: '/game',
    name: 'game',
    component: GameView
  },
  {
    path: '/friends',
    name: 'friends',
    component: () => import('./views/FriendsView.vue')
  },
  {
    path: '/rooms',
    name: 'RoomLobby',
    component: RoomLobby
  },
  {
    path: '/rooms/:roomCode',
    name: 'GameRoom',
    component: GameRoom
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  const publicPages = ['/login', '/register', '/', '/verify'];
  const authRequired = !publicPages.includes(to.path);
  const loggedIn = localStorage.getItem('token');

  if (authRequired && !loggedIn) {
    return next('/login');
  }
  next();
});

export default router