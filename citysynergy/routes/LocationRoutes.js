const express = require("express");
const router = express.Router();
const LocationController = require("../controllers/LocationsController");

// ✅ Route to search cities
router.get("/search-city", LocationController.searchCity);

// ✅ Route to search zones
router.get("/search-zone", LocationController.searchZone);

// ✅ Route to search local areas
router.get("/search-local-area", LocationController.searchLocalArea);

// ✅ Route to search pincodes
router.get("/search-pincode", LocationController.searchPincode);

// ✅ Route to search pincodes
router.get("/search-locality", LocationController.searchLocality);

module.exports = router;
