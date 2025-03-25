const express = require("express");
const {
  raiseIssue,
  searchLocality,
  searchPincode,
  updateIssueStatus,
  getIssueDetailsById,
  getAllUnresolvedIssues,
  getIssueStatusById,
  getResolvedIssuesByDateRange,
  getIssuesByDeptId,
  getIssueCategories,
  getDeptList2
} = require("../controllers/IssueController");


const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");

// ✅ Multer Config for Memory Storage (Cloudinary Upload)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits:{
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },

});

const router = express.Router();

// ✅ Routes

// Raise a New Issue with Image Upload

router.post("/raiseIssue", upload.single("image"), raiseIssue);

router.get("/search-pincode", searchPincode);

// Search Locality API
router.get("/search-locality", searchLocality);

router.get("/getIssueCategories", getIssueCategories);


router.get("/get-status/:issueId", getIssueStatusById);

router.put("/update-status/:issueId", updateIssueStatus);

router.get("/get-issue-details/:issueId", getIssueDetailsById);

router.get("/get-unresolved-issues", getAllUnresolvedIssues);

router.get("/get-resolved-issues-by-date", getResolvedIssuesByDateRange);

router.get("/get-issues", authMiddleware, getIssuesByDeptId);

router.get("/search-department", getDeptList2);


module.exports = router;
