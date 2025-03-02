// Authentication routes

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to the system
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     permissions:
 *                       type: array
 *                     tokens:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);

// OTP verification and password setting route
router.post('/verify-otp', authController.verifyOtpAndSetNewPassword);

router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.post(
    '/change-password',
    authMiddleware,
    authController.changePassword
);

router.post(
    '/reset-password/:userId',
    authMiddleware, // Ensure authMiddleware is applied first
    authorizeMiddleware(['Users Management'], 'canUpdate'),
    authController.resetPassword
);

module.exports = router;
