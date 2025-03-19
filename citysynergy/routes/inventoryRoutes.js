const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const inventoryController = require("../controllers/inventoryController");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Resource Management Routes
router.post("/", inventoryController.createResource);
router.get("/", inventoryController.listDepartmentResources);
router.get("/history", inventoryController.getInventoryHistory);
router.get("/sharing", inventoryController.getSharableResources);

// Sharing Management Routes
router.post("/:itemId/share", inventoryController.markItemAsShareable);

// Request System Routes
router.post("/request", inventoryController.createResourceRequest);
router.get("/requests", inventoryController.getResourceRequests);
router.put("/request/:requestId/status", inventoryController.updateRequestStatus);

// Return/Transfer System Routes
router.post("/:itemId/return", inventoryController.returnBorrowedItems);

// Borrowed Items Routes
router.get("/borrowed", inventoryController.getBorrowedItems);
router.get("/lent", inventoryController.getLentItems);

// Search & Filtering Route
router.get("/search", inventoryController.searchInventory);

module.exports = router;
