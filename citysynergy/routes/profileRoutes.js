const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *                     profile:
 *                       type: object
 *                       properties:
 *                         uuid:
 *                           type: string
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         type:
 *                           type: string
 *                         department:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             code:
 *                               type: string
 *                         lastLogin:
 *                           type: string
 *                           format: date-time
 *                     permissions:
 *                       type: array
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/',
    authMiddleware,
    profileController.viewProfile
);

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.put(
    '/',
    authMiddleware,
    profileController.updateProfile
);

module.exports = router; 