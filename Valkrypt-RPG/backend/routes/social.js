const express = require('express');
const SocialController = require('../controllers/SocialController');

const router = express.Router();

router.post('/presence/heartbeat', SocialController.heartbeat);
router.get('/state/:userId', SocialController.getState);
router.get('/users/search', SocialController.searchUsers);
router.post('/friends/request', SocialController.sendFriendRequest);
router.post('/friends/accept', SocialController.acceptFriendRequest);
router.post('/friends/reject', SocialController.rejectFriendRequest);
router.get('/chat', SocialController.getChatMessages);
router.post('/chat/send', SocialController.sendChatMessage);

module.exports = router;
