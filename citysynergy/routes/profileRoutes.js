const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/',
    profileController.viewProfile
);

router.put('/',
    profileController.updateProfile
);

module.exports = router;