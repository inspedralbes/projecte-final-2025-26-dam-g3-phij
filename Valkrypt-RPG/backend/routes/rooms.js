const express = require('express');
const RoomController = require('../controllers/RoomController');
const { ensureUserMatchesFrom } = require('../middleware/auth');

const router = express.Router();

// Create a new room
router.post('/create', RoomController.createRoom);

// Get all active rooms
router.get('/active', RoomController.getActiveRooms);

// Get player's rooms
router.get('/player/:userId', ensureUserMatchesFrom('params', 'userId'), RoomController.getPlayerRooms);

// Get room details
router.get('/:roomCode', RoomController.getRoomDetails);

// Join a room
router.post('/join', RoomController.joinRoom);

// Leave a room
router.post('/leave', ensureUserMatchesFrom('body', 'userId'), RoomController.leaveRoom);

// Start the game
router.post('/start', ensureUserMatchesFrom('body', 'userId'), RoomController.startGame);

// Set player character inside room
router.post('/character', ensureUserMatchesFrom('body', 'userId'), RoomController.setCharacter);

// Assign role in role-selection phase
router.post('/role', ensureUserMatchesFrom('body', 'userId'), RoomController.assignRole);

// Submit turn choice in active phase
router.post('/turn-choice', ensureUserMatchesFrom('body', 'userId'), RoomController.submitTurnChoice);

// Delete a room (host only)
router.post('/delete', ensureUserMatchesFrom('body', 'userId'), RoomController.deleteRoom);

module.exports = router;
