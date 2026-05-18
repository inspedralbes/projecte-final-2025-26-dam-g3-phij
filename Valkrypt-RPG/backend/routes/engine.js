const express = require('express');
const EngineController = require('../controllers/EngineController');

const router = express.Router();

router.get('/contexts/:sessionId', EngineController.getContext);
router.post('/contexts/:sessionId/push', EngineController.pushContext);

router.get('/rooms/:roomId/history', EngineController.roomHistory);
router.post('/rooms/:roomId/send', EngineController.roomSend);

router.get('/chronicles', EngineController.listChronicles);
router.get('/chronicles/export/pdf', EngineController.exportChroniclesPdf);

module.exports = router;
