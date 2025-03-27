const express = require("express");
const { loadMessages } = require("../controllers/loadMessagesController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Load messages for a specific clashId
router.get("/messages", authMiddleware, loadMessages);

module.exports = router;