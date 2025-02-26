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

router.get('/',
    authorizeMiddleware(['Role Management'], 'canRead'),
    roleController.getRoles
);

module.exports = router;