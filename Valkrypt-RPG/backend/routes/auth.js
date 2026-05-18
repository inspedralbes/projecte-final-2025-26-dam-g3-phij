const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

// Rutas
router.post('/register', AuthController.register);
router.post('/verify', AuthController.verify);
router.post('/resend-otp', AuthController.resendOtp);
router.post('/login', AuthController.login);

module.exports = router;
