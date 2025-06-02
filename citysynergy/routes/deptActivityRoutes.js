const express = require('express');
const router = express.Router();
const deptActivityController = require('../controllers/deptActivityController');
const authenticateUser = require('../middleware/authMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
// You should add your authentication middleware here, e.g. requireAuth
// const requireAuth = require('../middleware/auth');

// Overview stats route (protected)
// router.get('/overview', requireAuth, deptActivityController.getDeptOverview);
router.get('/overview', authenticateUser, deptActivityController.getDeptOverview);

// Analytics routes
router.get('/tenders-by-month', authenticateUser, deptActivityController.getTendersByMonth);
router.get('/inventory-category-distribution', authenticateUser, deptActivityController.getInventoryCategoryDistribution);
router.get('/clash-resolution', authenticateUser, deptActivityController.getClashResolution);
router.get('/recent-activity', authenticateUser, deptActivityController.getRecentActivity);

module.exports = router;
