const express = require("express");
const router = express.Router();
const { checkClashesNewHandler, getClashIdByDeptId,getInvolvedDeptStatus,getClashesByDeptId,updateInvolvedDeptStatus } = require("../controllers/UpdatedClashTenderController");
const authenticateUser = require("../middleware/authMiddleware");

// Route to check clashes based on pincode
router.post("/check-clashes", checkClashesNewHandler);

router.get("/department", authenticateUser, getClashesByDeptId);

router.get("/deptId", authenticateUser, getClashIdByDeptId);

// Route to get involved department status for a clashID
router.get("/:clashID/involved-departments", authenticateUser, getInvolvedDeptStatus);

// Route to update involved department status for a clashID
router.put("/:clashID/involved-departments", authenticateUser, updateInvolvedDeptStatus);

module.exports = router;
