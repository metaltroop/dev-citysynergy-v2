// File: routes/activityRoutes.js

const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: Activity monitoring and system statistics
 */

/**
 * @swagger
 * /api/activity/dev-dashboard:
 *   get:
 *     summary: Get all dashboard data in a single API call (for dev admin)
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of recent activities to return
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include in system activity statistics
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         userCount:
 *                           type: integer
 *                           description: Total number of active users
 *                         deptCount:
 *                           type: integer
 *                           description: Total number of active departments
 *                         clashCount:
 *                           type: integer
 *                           description: Number of active clashes
 *                         systemHealth:
 *                           type: number
 *                           format: float
 *                           description: System health percentage
 *                     recentActivities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           description:
 *                             type: string
 *                           user:
 *                             type: object
 *                           department:
 *                             type: object
 *                           metadata:
 *                             type: object
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                     systemActivity:
 *                       type: object
 *                       properties:
 *                         dailyActivity:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               count:
 *                                 type: integer
 *                         activityTypes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/dev-dashboard', 
    authMiddleware,
    authorizeMiddleware(['Users Management'], 'canRead'), // Ensure only users with appropriate permissions can access
    activityController.getDevDashboard
);

/**
 * @swagger
 * /api/activity/recent:
 *   get:
 *     summary: Get recent system activity
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of activities to return
 *     responses:
 *       200:
 *         description: Recent activities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       description:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                       department:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                       metadata:
 *                         type: object
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/recent', 
    authMiddleware, 
    activityController.getRecentActivity
);

/**
 * @swagger
 * /api/activity/system:
 *   get:
 *     summary: Get system activity statistics
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include in statistics
 *     responses:
 *       200:
 *         description: System activity statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     dailyActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           count:
 *                             type: integer
 *                     activityTypes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           count:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/system', 
    authMiddleware, 
    activityController.getSystemActivity
);

/**
 * @swagger
 * /api/activity/dashboard-stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Activity]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userCount:
 *                       type: integer
 *                       description: Total number of active users
 *                     deptCount:
 *                       type: integer
 *                       description: Total number of active departments
 *                     clashCount:
 *                       type: integer
 *                       description: Number of active clashes
 *                     systemHealth:
 *                       type: number
 *                       format: float
 *                       description: System health percentage
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/dashboard-stats', 
    authMiddleware, 
    activityController.getDashboardStats
);

module.exports = router; 