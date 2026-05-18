const express = require('express');
const AdminController = require('../controllers/AdminController');

const router = express.Router();

router.get('/ai-settings', AdminController.getAiSettings);
router.put('/ai-settings', AdminController.updateAiSettings);
router.post('/ai-settings/test', AdminController.testAiSettings);

router.get('/inventory', AdminController.listInventory);
router.post('/inventory', AdminController.createInventoryItem);
router.put('/inventory/:id', AdminController.updateInventoryItem);
router.delete('/inventory/:id', AdminController.deleteInventoryItem);

router.get('/users', AdminController.listUsers);
router.patch('/users/:userId/suspension', AdminController.toggleUserSuspension);
router.get('/logs', AdminController.listLogs);

module.exports = router;
