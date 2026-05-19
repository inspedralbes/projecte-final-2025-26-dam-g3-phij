const express = require('express');
const SocialController = require('../controllers/SocialController');
const { ensureUserMatchesFrom } = require('../middleware/auth');

const router = express.Router();

router.post('/presence/heartbeat', ensureUserMatchesFrom('body', 'userId'), SocialController.heartbeat);
router.get('/state/:userId', ensureUserMatchesFrom('params', 'userId'), SocialController.getState);
router.get('/profile/:username', SocialController.getPublicProfile);
router.get('/users/search', ensureUserMatchesFrom('query', 'userId'), SocialController.searchUsers);
router.post('/friends/request', ensureUserMatchesFrom('body', 'userId'), SocialController.sendFriendRequest);
router.post('/friends/accept', ensureUserMatchesFrom('body', 'userId'), SocialController.acceptFriendRequest);
router.post('/friends/reject', ensureUserMatchesFrom('body', 'userId'), SocialController.rejectFriendRequest);
router.get('/chat', ensureUserMatchesFrom('query', 'userId'), SocialController.getChatMessages);
router.post('/chat/send', ensureUserMatchesFrom('body', 'userId'), SocialController.sendChatMessage);

module.exports = router;
