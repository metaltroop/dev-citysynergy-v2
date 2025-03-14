const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management
 */

router.use(authMiddleware);

/**
 * @swagger
 * /api/roles/assign:
 *   post:
 *     summary: Assign roles to a user
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - roles
 *             properties:
 *               userId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Roles assigned successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 */
router.post('/assign',
    authorizeMiddleware(['Role Management'], 'canWrite'),
    roleController.assignRoles
);

/**
 * @swagger
 * /api/roles/fetchdevroles:
 *   get:
 *     summary: Get all developer roles with their features and permissions
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Developer roles retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/fetchdevroles',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getdevRoles
);

/**
 * @swagger
 * /api/roles/devrole/{roleId}/permissions:
 *   get:
 *     summary: Get permissions for a specific role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role permissions retrieved successfully
 *       404:
 *         description: Role not found
 */
router.get('/devrole/:roleId/permissions',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getDevRolePermissions
);

/**
 * @swagger
 * /api/roles/devrole/{roleId}/permissions:
 *   put:
 *     summary: Update permissions for a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     featureId:
 *                       type: string
 *                     canRead:
 *                       type: boolean
 *                     canWrite:
 *                       type: boolean
 *                     canUpdate:
 *                       type: boolean
 *                     canDelete:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *       404:
 *         description: Role not found
 */
router.put('/devrole/:roleId/permissions',
    authorizeMiddleware(['Role Management'], 'canUpdate'),
    roleController.updateDevRolePermissions
);

/**
 * @swagger
 * /api/roles/devrole/{roleId}:
 *   put:
 *     summary: Delete a developer role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 */
router.put('/devrole/:roleId',
    authorizeMiddleware(['Role Management'], 'canDelete'),
    roleController.deleteDevRole
);

/**
 * @swagger
 * /api/roles/fetchdeptrolesbydeptid/{deptId}:
 *   get:
 *     summary: Get department roles by department ID
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department roles retrieved successfully
 *       404:
 *         description: Department not found
 */
router.get('/fetchdeptrolesbydeptid/:deptId',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getDeptRolesByDeptId
);

/**
 * @swagger
 * /api/roles/devrole:
 *   post:
 *     summary: Create a new developer role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/devrole',
    authorizeMiddleware(['Role Management'], 'canWrite'),
    roleController.createDevRole
);

module.exports = router;