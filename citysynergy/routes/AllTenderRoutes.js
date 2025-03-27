const express = require("express");
const All_TendersController = require("../controllers/All_TendersController");

const authMiddleware=require('../middleware/authMiddleware');

const router = express.Router();

// 1️⃣ Get All Tenders
router.get("/", All_TendersController.getAllTenders);

//add tender
router.post("/addtendermain", authMiddleware,All_TendersController.addTendermain);
router.get("/suggestions",All_TendersController.getSuggestions);
router.get("/tenderbyrange", All_TendersController.getAllTendersbyrange);

// 2️⃣ Get Tenders by Department (Requires Authentication)
router.get("/department",authMiddleware, All_TendersController.getTendersByDepartment);

// 3️⃣ Add a Tender (Restricted by Department)
// router.post("/add", addTender);

router.get("/:tenderId",authMiddleware, All_TendersController.getTenderById);







// 4️⃣ Update a Tender (Restricted by Department)
router.put("/:id",authMiddleware, All_TendersController.updateTender);

// 5️⃣ Delete a Tender (Restricted by Department)
router.delete("/:id",authMiddleware, All_TendersController.deleteTender);

module.exports = router;