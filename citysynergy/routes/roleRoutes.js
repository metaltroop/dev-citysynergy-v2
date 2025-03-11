const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

router.use(authMiddleware);

router.post('/assign',
    authorizeMiddleware(['Role Management'], 'canWrite'),
    roleController.assignRoles
);

// Get all dev roles with their features and permissions
router.get('/fetchdevroles',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getdevRoles
);

// Get permissions for a specific role
router.get('/devrole/:roleId/permissions',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getDevRolePermissions
);

// Update permissions for a role
router.put('/devrole/:roleId/permissions',
    authorizeMiddleware(['Role Management'], 'canUpdate'),
    roleController.updateDevRolePermissions
);

// Delete a dev role
router.put('/devrole/:roleId',
    authorizeMiddleware(['Role Management'], 'canDelete'),
    roleController.deleteDevRole
);

router.get('/fetchdeptrolesbydeptid/:deptId',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getDeptRolesByDeptId
);

// Create a new dev role
router.post('/devrole',
    authorizeMiddleware(['Role Management'], 'canWrite'),
    roleController.createDevRole
);

module.exports = router;