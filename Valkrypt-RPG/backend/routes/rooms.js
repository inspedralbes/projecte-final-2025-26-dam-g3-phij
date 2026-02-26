const express = require('express');
const RoomController = require('../controllers/RoomController');

const router = express.Router();

// Create a new room
router.post('/create', RoomController.createRoom);

// Get all active rooms
router.get('/active', RoomController.getActiveRooms);

// Get room details
router.get('/:roomCode', RoomController.getRoomDetails);

// Join a room
router.post('/join', RoomController.joinRoom);

// Leave a room
router.post('/leave', RoomController.leaveRoom);

// Start the game
router.post('/start', RoomController.startGame);

// Delete a room (host only)
router.post('/delete', RoomController.deleteRoom);

// Get player's rooms
router.get('/player/:userId', RoomController.getPlayerRooms);

module.exports = router;
