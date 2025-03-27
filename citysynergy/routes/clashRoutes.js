const express = require("express");
const {
  checkClashesNewHandler,
  checkClashesNew,
  getClashesByDeptId,
  getClashIdByDeptId,
  getInvolvedDeptStatus,
  updateInvolvedDeptStatus,
} = require("../controllers/clashTenderController");
const authenticateUser = require("../middleware/authMiddleware");

const router = express.Router();

// Route to check tender clashes by pincode
router.post("/checkclashepin", checkClashesNewHandler);

router.get("/department", authenticateUser, getClashesByDeptId);

router.get("/deptId", authenticateUser, getClashIdByDeptId);

// Route to get involved department status for a clashID
router.get("/clashes/:clashID/involved-departments", authenticateUser, getInvolvedDeptStatus);

// Route to update involved department status for a clashID
router.put("/clashes/:clashID/involved-departments", authenticateUser, updateInvolvedDeptStatus);


module.exports = router;
