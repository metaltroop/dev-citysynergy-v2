// Department routes

const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get(
    '/',
    authorizeMiddleware(['Department Management'], 'canRead'),
    departmentController.getDepartments
);

/**
 * @swagger
 * /api/departments:
 *   post:
 *     summary: Create a new department
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deptName
 *               - deptCode
 *               - headUserId
 *             properties:
 *               deptName:
 *                 type: string
 *               deptCode:
 *                 type: string
 *               headUserId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Invalid input data
 */
router.post(
    '/',
    authorizeMiddleware(['Department Management'], 'canWrite'),
    departmentController.createDepartment
);

router.put('/editDeptName/:deptId',
    authorizeMiddleware(['Department Management'], 'canUpdate'),
    departmentController.editDeptName
)

/**
 * @swagger
 * /api/departments/{deptId}:
 *   put:
 *     summary: Update department
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
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
 *               deptName:
 *                 type: string
 *               deptCode:
 *                 type: string
 *               headUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Department updated successfully
 *       404:
 *         description: Department not found
 */
router.put(
    '/:deptId',
    authorizeMiddleware(['Department Management'], 'canUpdate'),
    departmentController.updateDepartment
);

/**
 * @swagger
 * /api/departments/{deptId}/features:
 *   get:
 *     summary: Get department features
 *     tags: [Departments]
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
 *         description: Department features retrieved successfully
 *       404:
 *         description: Department not found
 */
router.get(
    '/:deptId/features',
    authorizeMiddleware(['Department Management'], 'canRead'),
    departmentController.getDepartmentFeatures
);

/**
 * @swagger
 * /api/departments/{deptId}/roles:
 *   post:
 *     summary: Create department role
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
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
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department role created successfully
 *       404:
 *         description: Department not found
 */
router.post(
    '/:deptId/roles',
    authorizeMiddleware(['Department Management'], 'canWrite'),
    departmentController.createDepartmentRole
);

/**
 * @swagger
 * /api/departments/{deptId}/roles:
 *   get:
 *     summary: Get department roles
 *     tags: [Departments]
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
router.get(
    '/:deptId/roles',
    authorizeMiddleware(['Department Management'], 'canRead'),
    departmentController.getDepartmentRoles
);

/**
 * @swagger
 * /api/departments/{deptId}/roles/{roleId}/features:
 *   post:
 *     summary: Assign features to department role
 *     tags: [Departments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
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
 *               - features
 *             properties:
 *               features:
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
 *         description: Features assigned successfully
 *       404:
 *         description: Department or role not found
 */
router.post(
    '/:deptId/roles/:roleId/features',
    authorizeMiddleware(['Department Management'], 'canWrite'),
    departmentController.assignFeaturesToRole
);

/**
 * @swagger
 * /api/departments/get-dept-list:
 *   get:
 *     summary: Get department list
 *     tags: [Departments]
    *     security:
 *       - BearerAuth: []
 */
router.post(
    '/get-dept-list',
    authorizeMiddleware(['Department Management'], 'canRead'),
    departmentController.getDeptList
);


router.put( '/delete-dept/:deptId',
    authorizeMiddleware(['Department Management'], 'canDelete'),
    departmentController.deleteDepartment
);

router.put('/restore-dept/:deptId',
    authorizeMiddleware(['Department Management'], 'canUpdate'),
    departmentController.restoreDept
);  

router.get('/get-dept/:deptId',
    authorizeMiddleware(['Department Management'], 'canRead'),
    departmentController.getDepartmentInfo
);

router.post('/checkdeptcode/:deptCode',
    authorizeMiddleware(['Department Management'], 'canRead'),
    departmentController.checkDeptCodeAvailablity
);

module.exports = router;