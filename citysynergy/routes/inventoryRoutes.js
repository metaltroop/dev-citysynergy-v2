const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const inventoryController = require("../controllers/inventoryController");

/**
 * @swagger
 * components:
 *   schemas:
 *     Resource:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         department:
 *           type: string
 *         quantity:
 *           type: number
 *         isShareable:
 *           type: boolean
 *     ResourceRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         resourceId:
 *           type: string
 *         requesterId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 */

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Resource Management Routes

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     summary: Create a new resource
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Resource'
 *     responses:
 *       201:
 *         description: Resource created successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/", inventoryController.createResource);

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: List department resources
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of resources
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Resource'
 */
router.get("/", inventoryController.listDepartmentResources);

/**
 * @route GET /api/inventory/history
 * @description Get inventory history with optional date range filtering
 * @query startDate - Optional start date (YYYY-MM-DD)
 * @query endDate - Optional end date (YYYY-MM-DD)
 */

/**
 * @swagger
 * /api/inventory/history:
 *   get:
 *     summary: Get inventory history
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Inventory history retrieved successfully
 */
router.get("/history", inventoryController.getInventoryHistory);

/**
 * @swagger
 * /api/inventory/sharing:
 *   get:
 *     summary: Get sharable resources
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sharable resources
 */
router.get("/sharing", inventoryController.getSharableResources);

/**
 * @swagger
 * /api/inventory/{itemId}/share:
 *   post:
 *     summary: Mark item as shareable
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item marked as shareable
 */
router.post("/:itemId/share", inventoryController.markItemAsShareable);

/**
 * @swagger
 * /api/inventory/request:
 *   post:
 *     summary: Create a resource request
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResourceRequest'
 *     responses:
 *       201:
 *         description: Request created successfully
 */
router.post("/request", inventoryController.createResourceRequest);

/**
 * @swagger
 * /api/inventory/requests:
 *   get:
 *     summary: Get all resource requests
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of resource requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ResourceRequest'
 */
router.get("/requests", inventoryController.getResourceRequests);

/**
 * @swagger
 * /api/inventory/request/{requestId}/status:
 *   put:
 *     summary: Update resource request status
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Request status updated successfully
 *       404:
 *         description: Request not found
 */
router.put("/request/:requestId/status", inventoryController.updateRequestStatus);

/**
 * @swagger
 * /api/inventory/{itemId}/return:
 *   post:
 *     summary: Return borrowed items
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item returned successfully
 *       404:
 *         description: Item not found
 */
router.post("/:itemId/return", inventoryController.returnBorrowedItems);

/**
 * @swagger
 * /api/inventory/borrowed:
 *   get:
 *     summary: Get list of items borrowed by the user
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of borrowed items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Resource'
 */
router.get("/borrowed", inventoryController.getBorrowedItems);

/**
 * @swagger
 * /api/inventory/lent:
 *   get:
 *     summary: Get list of items lent by the user's department
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lent items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Resource'
 */
router.get("/lent", inventoryController.getLentItems);

/**
 * @swagger
 * /api/inventory/search:
 *   get:
 *     summary: Search inventory items
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: isShareable
 *         schema:
 *           type: boolean
 *         description: Filter by shareable status
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Resource'
 */
router.get("/search", inventoryController.searchInventory);

module.exports = router;
