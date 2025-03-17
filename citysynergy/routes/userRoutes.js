// User routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/users/check-username:
 *   post:
 *     summary: Check if username is available
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
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Username is available
 *       409:
 *         description: Username already exists
 */
router.post('/check-username', express.json(), userController.checkUsernameAvailability);

/**
 * @swagger
 * /api/users/check-email:
 *   post:
 *     summary: Check if email is available
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
 *     responses:
 *       200:
 *         description: Email is available
 *       409:
 *         description: Email already exists
 */
router.post('/check-email', express.json(), userController.checkEmailAvailability);

/**
 * @swagger
 * /api/users/department:
 *   get:
 *     summary: Get users from the same department as the logged-in user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for username or email
 *     responses:
 *       200:
 *         description: List of department users retrieved successfully
 *       403:
 *         description: User not associated with any department
 *       404:
 *         description: No users found in department or department not found
 */
router.get('/department', userController.getDeptUsers);

/**
 * @swagger
 * /api/users/department/{uuid}:
 *   get:
 *     summary: Get a specific user from the logged-in user's department by ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the user to retrieve
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       403:
 *         description: User not associated with any department
 *       404:
 *         description: User not found in department or department not found
 */
router.get('/department/:uuid', userController.getDeptuserById);

/**
 * @swagger
 * /api/users/department:
 *   post:
 *     summary: Create a new user in the logged-in user's department
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
 *               - username
 *               - email
 *               - roleId
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for the new user
 *               email:
 *                 type: string
 *                 description: Email for the new user
 *               roleId:
 *                 type: string
 *                 description: Role ID from the department's role table
 *     responses:
 *       201:
 *         description: Department user created successfully
 *       400:
 *         description: Missing required fields or invalid input
 *       403:
 *         description: User not associated with any department
 *       500:
 *         description: Server error
 */
router.post('/department', userController.createUserForDept);

/**
 * @swagger
 * /api/users/department/{uuid}:
 *   put:
 *     summary: Update a user's username in the logged-in user's department
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username for the user
 *     responses:
 *       200:
 *         description: Department user updated successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: User not associated with any department
 *       404:
 *         description: User not found in department
 *       500:
 *         description: Server error
 */
router.put('/department/:uuid', userController.editDeptUserById);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [dev, dept]
 *         description: Filter users by type
 *       - in: query
 *         name: deptId
 *         schema:
 *           type: string
 *         description: Filter users by department ID
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/', 
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUsers
);

/**
 * @swagger
 * /api/users/unassigned:
 *   get:
 *     summary: Get users not assigned to any department
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for username or email
 *     responses:
 *       200:
 *         description: List of unassigned users retrieved successfully
 *       404:
 *         description: No unassigned users found
 */
router.get('/unassigned',
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUnassignedUsers
);

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
 *               - username
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [dev, dept]
 *                 default: dept
 *               deptId:
 *                 type: string
 *               roleId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/',
    authorizeMiddleware(['Users Management'], 'canWrite'),
    userController.createUser
);

/**
 * @swagger
 * /api/users/{uuid}:
 *   get:
 *     summary: Get user by ID
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
    authorizeMiddleware(['Users Management'], 'canRead'),
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
    authorizeMiddleware(['Users Management'], 'canUpdate'),
    userController.updateUser
);

/**
 * @swagger
 * /api/users/{uuid}:
 *   delete:
 *     summary: Delete user
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
router.delete('/:uuid',
    authorizeMiddleware(['Users Management'], 'canDelete'),
    userController.deleteUser
);

module.exports = router;
