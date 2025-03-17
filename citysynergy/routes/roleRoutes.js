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

/**
 * @swagger
 * /api/roles/department:
 *   post:
 *     summary: Create a new role in the logged-in user's department
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Name of the role to create
 *               roleDescription:
 *                 type: string
 *                 description: Description of the role (optional)
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Department role created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId:
 *                       type: string
 *                       example: DEP001
 *                     roleName:
 *                       type: string
 *                       example: Viewer
 *                     roleDescription:
 *                       type: string
 *                       example: Read-only access to department features
 *                     department:
 *                       type: object
 *                       properties:
 *                         deptId:
 *                           type: string
 *                           example: dept123
 *                         deptName:
 *                           type: string
 *                           example: Finance
 *                         deptCode:
 *                           type: string
 *                           example: FIN
 *       400:
 *         description: Bad request - Role name is required
 *       403:
 *         description: Forbidden - User not associated with any department
 *       500:
 *         description: Internal server error
 */
router.post('/department', authMiddleware, roleController.createDeptRole);

module.exports = router;