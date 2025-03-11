const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

router.use(authMiddleware);

// Get all dev features with their role permissions
router.get('/devfeatures',
    authorizeMiddleware(['Feature Management'], 'canRead'),
    featureController.getDevFeatures
);

module.exports = router;