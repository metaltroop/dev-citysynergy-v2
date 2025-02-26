const express = require('express');
const router = express.Router();
const passwordController = require('../controllers/passwordController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/password/change:
 *   post:
 *     summary: Change user password
 *     tags: [Password Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password
 */
router.post('/change', 
    authMiddleware,
    passwordController.changePassword
);

/**
 * @swagger
 * /api/password/forgot:
 *   post:
 *     summary: Request password reset
 *     tags: [Password Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset email sent successfully
 *       404:
 *         description: User not found
 */
router.post('/forgot', passwordController.forgotPassword);

/**
 * @swagger
 * /api/password/reset:
 *   post:
 *     summary: Reset password using token
 *     tags: [Password Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       401:
 *         description: Invalid or expired token
 */
router.post('/reset', passwordController.resetPassword);

module.exports = router; 