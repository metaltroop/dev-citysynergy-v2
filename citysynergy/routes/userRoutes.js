// User routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authorizeMiddleware } = require('../middleware/authorizeMiddleware');

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
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
 *               type:
 *                 type: string
 *                 enum: [dev, dept]
 *                 default: dept
 *               deptId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 */
router.post('/',
    authorizeMiddleware(['User Management'], 'canWrite'),
    userController.createUser
);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get list of users
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [dev, dept]
 *       - in: query
 *         name: deptId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/',
    authorizeMiddleware(['User Management'], 'canRead'),
    userController.getUsers
);

/**
 * @swagger
 * /api/users/{uuid}:
 *   get:
 *     summary: Get user by UUID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:uuid',
    authorizeMiddleware(['User Management'], 'canRead'),
    userController.getUser
);

/**
 * @swagger
 * /api/users/{uuid}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:uuid',
    authorizeMiddleware(['User Management'], 'canUpdate'),
    userController.updateUser
);

/**
 * @swagger
 * /api/users/{uuid}:
 *   delete:
 *     summary: Delete user (soft delete)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete(
    '/:uuid',
    authorizeMiddleware(['Users Management'], 'canDelete'),
    userController.deleteUser
);

module.exports = router;
