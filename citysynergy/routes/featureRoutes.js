const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Features
 *   description: Feature management
 */

/**
 * @swagger
 * /api/features/devfeatures:
 *   get:
 *     summary: Get all development features with their role permissions
 *     tags: [Features]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Features retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */

// Get all dev features with their role permissions
router.get('/dev',
    authorizeMiddleware(['Feature Management'], 'canRead'),
    featureController.getDevFeatures
);

/**
 * @swagger
 * /api/features/deptfeatures:
 *   get:
 *     summary: Get all department features
 *     tags: [Features]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Features retrieved successfully
 *       401:
 *         description: Unauthorized    
 */
router.get('/dept',
    authMiddleware, 
    featureController.getDeptFeatures
);

module.exports = router;    