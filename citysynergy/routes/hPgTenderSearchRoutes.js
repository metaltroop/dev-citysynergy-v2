const express = require('express');
const router = express.Router();
const tenderSearchController = require('../controllers/hPgTenderSearchController');

router.get('/pincodes', tenderSearchController.getPincodes);
router.get('/areas', tenderSearchController.getAreas);
router.get('/local-areas', tenderSearchController.getLocalAreas);
router.get('/search', tenderSearchController.searchTenders);

module.exports = router;
