const { uploadImage1 } = require("../services/cloudinaryService");
const { withTransaction } = require('../utils/transactionManager');


const { Op } = require("sequelize");

const emailService = require("../services/emailService");
const validateEmail = require("../utils/smtpValidator");

// ✅ Function to Find Related Issues
const findRelatedIssue = async (sequelize, newIssueData) => {
  const { CommonIssuees } = sequelize.models;
  const { IssueName, IssueCategory, pincode, locality, IssueDescription } = newIssueData;

  // Calculate 3 months before and after the current date
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const threeMonthsAhead = new Date();
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

  // Find existing issues within the criteria
  const relatedIssues = await CommonIssuees.findAll({
    where: {
      createdAt: { [Op.between]: [threeMonthsAgo, threeMonthsAhead] },
      pincode,
      locality,
      IssueCategory,
      IssueName,
      IssueDescription: { [Op.like]: `%${IssueDescription.split(" ").slice(0, 3).join("%")}%` } // Match first 3 words
    },
    order: [["createdAt", "DESC"]], // Sort by most recent first
  });

  // Return IssueId of the most related issue, if found
  return relatedIssues.length > 0 ? relatedIssues[0].IssueId : null;
};

// ✅ Raise Issue API
exports.raiseIssue = async (req, res) => {
  try {
    const {
      raisedByEmailID,
      raisedByName,
      IssueCategory,
      deptId,
      IssueName,
      IssueDescription,
      address,
      pincode,
      locality,
    } = req.body;

    const { sequelize } = req.app.locals;
    const { Pincode, CommonIssuees, Locality, CommonDept } = sequelize.models;

    // Validate Email via SMTP
    const isValidEmail = await validateEmail(raisedByEmailID);
    if (!isValidEmail) {
      return res.status(400).json({ message: "Invalid Email ID" });
    }

    // Create issue within a transaction
    const result = await withTransaction(async (transaction) => {
      // Check if Pincode and Locality exist in DB
      const [isPincodeValid, isLocalityValid] = await Promise.all([
        Pincode.findOne({ where: { pincode }, transaction }),
        Locality.findOne({ where: { id: locality }, transaction })
      ]);

      if (!isPincodeValid || !isLocalityValid) {
        throw new Error("Invalid Pincode or Locality");
      }

      let imageUrl = null;

      // Handle Image Upload to Cloudinary
      if (req.file) {
        try {
          imageUrl = await uploadImage1(req.file.buffer, raisedByEmailID);
          imageUrl = imageUrl.secure_url;
        } catch (uploadError) {
          throw new Error("Image Upload Failed");
        }
      } else {
        throw new Error("Image upload failed. Please attach an image.");
      }

      // Find Related Issue
      const relatedIssueId = await findRelatedIssue(sequelize, {
        IssueCategory,
        IssueName,
        IssueDescription,
        pincode,
        locality,
      });

      // Create New Issue
      const newIssue = await CommonIssuees.create({
        raisedByEmailID,
        raisedByName,
        IssueCategory,
        deptId,
        IssueName,
        IssueDescription,
        Related: relatedIssueId,
        address,
        image: imageUrl,
        pincode: String(pincode),
        locality: locality,
      }, { transaction });

      return newIssue;
    });

    // Send email notification after successful transaction
    await emailService.sendIssueRaisedNotification(result);

    res.status(201).json({
      message: "Issue Raised Successfully",
      data: result,
    });

  } catch (error) {
    console.error("Error in raiseIssue:", error);
    res.status(500).json({
      message: error.message || "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Search Pincode API
exports.searchPincode = async (req, res) => {
  const { pincode } = req.query;

  const { sequelize } = req.app.locals; // Added sequelize
  const { Pincode } = sequelize.models; // Added Pincode model

  if (!pincode || pincode.length < 2) {
    return res.status(400).json({ message: "Type at least 2 digits" });
  }

  try {
    const pincodes = await Pincode.findAll({
      where: {
        pincode: {
          [Op.like]: `${pincode}%`,
        },
      },
    });
    res.status(200).json(pincodes);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Search Locality API
exports.searchLocality = async (req, res) => {
  const { locality } = req.query;

  const { sequelize } = req.app.locals; // Added sequelize
  const { Locality } = sequelize.models; // Added Locality model

  if (!locality || locality.length < 2) {
    return res.status(400).json({ message: "Type at least 2 characters" });
  }

  try {
    const localities = await Locality.findAll({
      where: {
        locality: {
          [Op.like]: `${locality}%`,
        },
      },
    });
    res.status(200).json(localities);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getIssueCategories = async (req, res) => {
  try {
    const { sequelize } = req.app.locals;
    const { CommonIssuees} = sequelize.models;


    // Extract ENUM values
    const enumValues = CommonIssuees.rawAttributes.IssueCategory.values;

    res.status(200).json(enumValues);
  } catch (error) {
    console.error("Error fetching issue categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getDeptList2 = async (req, res) => {
  const { search } = req.query;
  const { sequelize } = req.app.locals;
  const { CommonDepts } = sequelize.models;

  try {
    // If search parameter is provided and has length < 2
    if (search !== undefined && search.length < 2) {
      return res.status(400).json({ message: "Type at least 2 characters" });
    }

    // Define where clause based on search parameter
    const whereClause = search ? {
      where: {
        deptName: {
          [Op.like]: `%${search}%`
        }
      }
    } : {};

    const departments = await CommonDepts.findAll({
      ...whereClause,
      attributes: ["deptId", "deptName"]
    });

    res.status(200).json(departments);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


// ✅ Update Issue Status API
exports.updateIssueStatus = async (req, res) => {
  const { issueId } = req.params;
  const { status } = req.body;

  const { sequelize } = req.app.locals; // Added sequelize
  const { CommonIssuees } = sequelize.models; // Added CommonIssuees model

  try {
    const issue = await CommonIssuees.findOne({ where: { IssueId: issueId } });

    if (!issue) {
      return res.status(404).json({ message: "Issue Not Found" });
    }

    const currentStatus = issue.issueStatus;

    const updatedStatus = {
      ...currentStatus,
      ...Object.fromEntries(
        Object.entries(status).map(([key, value]) => {
          if (currentStatus[key] === true && value === false) {
            return [key, true];
          }
          return [key, value];
        })
      ),
    };

    await issue.update({ issueStatus: updatedStatus });

    res
      .status(200)
      .json({ message: "Issue Status Updated Successfully", updatedStatus });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Get Issue Status by ID API
exports.getIssueStatusById = async (req, res) => {
  const { issueId } = req.params;
  const { sequelize } = req.app.locals; // Get sequelize instance
  const { CommonIssuees } = sequelize.models; // Get CommonIssuees model

  try {
    const issue = await CommonIssuees.findOne({ where: { IssueId: issueId } });

    if (!issue) {
      return res.status(404).json({ message: "Issue Not Found" });
    }

    let status = issue.issueStatus;

    // If resolved, all previous statuses should be true
    if (status.resolved) {
      status = {
        raised: true,
        in_review: true,
        accepted: true,
        pending: true,
        working: true,
        resolved: true
      };
    }

    // Ensure status flow consistency
    const statusFlow = ["raised", "in_review", "accepted", "pending", "working", "resolved"];
    let lastTrueIndex = -1;

    // Find the last true status in the flow
    for (let i = statusFlow.length - 1; i >= 0; i--) {
      if (status[statusFlow[i]]) {
        lastTrueIndex = i;
        break;
      }
    }

    // All statuses before the last true status should be true
    if (lastTrueIndex > 0) {
      for (let i = 0; i < lastTrueIndex; i++) {
        status[statusFlow[i]] = true;
      }
    }

    res.status(200).json({ issueStatus: status });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.getIssueStatusesByDeptId = async (req, res) => {
  const { deptId } = req.user; // Extract deptId from the authenticated user's token

  const { sequelize } = req.app.locals; // Get Sequelize instance
  const { CommonIssuees } = sequelize.models; // Get the Issues model

  try {
    // Fetch all issues for the given department ID
    const issues = await CommonIssuees.findAll({
      where: { deptId },
      attributes: ["IssueId", "issueStatus"], // Only fetch IssueId and issueStatus
    });

    if (!issues || issues.length === 0) {
      return res.status(404).json({ message: "No issues found for this department" });
    }

    // Return the statuses of all issues
    res.status(200).json({ success: true, issues });
  } catch (error) {
    console.error("Error in getIssueStatusesByDeptId:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Get Issue Details by ID API
exports.getIssueDetailsById = async (req, res) => {
  const { issueId } = req.params;

  const { sequelize } = req.app.locals; // Added sequelize
  const { CommonIssuees } = sequelize.models; // Added CommonIssuees model

  try {
    const issue = await CommonIssuees.findOne({ where: { IssueId: issueId } });

    if (!issue) {
      return res.status(404).json({ message: "Issue Not Found" });
    }

    res.status(200).json({ issue });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Get All Unresolved Issues API
exports.getAllUnresolvedIssues = async (req, res) => {
  const { sequelize } = req.app.locals; // Added sequelize
  const { CommonIssuees } = sequelize.models; // Added CommonIssuees model

  try {
    const issues = await CommonIssuees.findAll({
      where: {
        "issueStatus.resolved": false,
      },
    });

    res.status(200).json({ issues });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Fetch Resolved Issues by Date Range API
exports.getResolvedIssuesByDateRange = async (req, res) => {
  const { startDate, endDate } = req.query;

  const { sequelize } = req.app.locals; // Added sequelize
  const { CommonIssuees } = sequelize.models; // Added CommonIssuees model

  try {
    const issues = await CommonIssuees.findAll({
      where: {
        "issueStatus.resolved": true,
        updatedAt: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    res.status(200).json({ issues });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Get Issues by Department ID API
exports.getIssuesByDeptId = async (req, res) => {
  const { deptId } = req.user;

  const { sequelize } = req.app.locals; // Added sequelize
  const { CommonIssuees } = sequelize.models; // Added CommonIssuees model

  try {
    const issues = await CommonIssuees.findAll({
      where: { deptId },
    });

    if (!issues || issues.length === 0) {
      return res
        .status(404)
        .json({ message: "No issues found for this department" });
    }

    res.status(200).json({ issues });
  } catch (error) {
    console.error("Error in getIssuesByDeptId:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
