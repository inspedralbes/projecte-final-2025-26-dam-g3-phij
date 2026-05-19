const express = require('express');
const EngineController = require('../controllers/EngineController');
const { ensureUserMatchesFrom } = require('../middleware/auth');

const router = express.Router();

router.get('/contexts/:sessionId', ensureUserMatchesFrom('query', 'userId'), EngineController.getContext);
router.post('/contexts/:sessionId/push', ensureUserMatchesFrom('body', 'userId'), EngineController.pushContext);

router.get('/rooms/:roomId/history', EngineController.roomHistory);
router.post('/rooms/:roomId/send', EngineController.roomSend);

router.get('/chronicles', ensureUserMatchesFrom('query', 'userId'), EngineController.listChronicles);
router.get('/chronicles/export/pdf', ensureUserMatchesFrom('query', 'userId'), EngineController.exportChroniclesPdf);

module.exports = router;
