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

router.get('/fetchdevroles',
    roleController.getdevRoles
);

router.get('/fetchdeptrolesbydeptid/:deptId',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getDeptRolesByDeptId
);

module.exports = router;