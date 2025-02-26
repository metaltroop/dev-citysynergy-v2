// User routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Routes
router.get('/', 
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUsers
);

router.get('/:uuid',
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUser
);

router.post('/',
    authorizeMiddleware(['Users Management'], 'canWrite'),
    userController.createUser
);

router.put('/:uuid',
    authorizeMiddleware(['Users Management'], 'canUpdate'),
    userController.updateUser
);

router.delete('/:uuid',
    authorizeMiddleware(['Users Management'], 'canDelete'),
    userController.deleteUser
);

module.exports = router;
