// User routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Check availability routes (no authorization required)
router.post('/check-username', express.json(), userController.checkUsernameAvailability);
router.post('/check-email', express.json(), userController.checkEmailAvailability);

// Protected routes
router.get('/', 
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUsers
);

router.get('/unassigned',
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUnassignedUsers
);

router.post('/',
    authorizeMiddleware(['Users Management'], 'canWrite'),
    userController.createUser
);

router.get('/:uuid',
    authorizeMiddleware(['Users Management'], 'canRead'),
    userController.getUser
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
