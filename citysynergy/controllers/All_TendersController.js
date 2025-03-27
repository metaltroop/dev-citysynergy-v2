// const {checkClashesNewHandler,checkClashesNew,storeClashesInDB} = require("../controllers/clashTenderController");
// const { AllTenders } = require("../models/All_Tenders");

const { Op } = require("sequelize");
const CommonPincode = require("../models/Pincode");
const CommonLocality = require("../models/Locality");

const { atwithTransaction } = require("../utils/atTransactionManager"); // ✅ Ensure correct import

const {
  checkClashesNew,
  storeClashesInDB,
} = require("../controllers/UpdatedClashTenderController");

// exports.addTendermain = async (req, res) => {
//   try {
//     await withTransaction(async (transaction) => {  // ✅ Wrap in transaction
//       console.log(req.body);
//       const { sequelize } = req.app.locals;

//       if (!sequelize) {
//         console.error("❌ Sequelize instance is missing!");
//         return res.status(500).json({ message: "Database connection issue" });
//       }

//       const { AllTenders } = sequelize.models;

//       if (!AllTenders) {
//         console.error("❌ AllTenders model is missing in Sequelize models:", sequelize.models);
//         return res.status(500).json({ message: "AllTenders model not found" });
//       }

//       const {
//         Tender_by_Department,
//         Tender_by_Classification,
//         Sanction_Date,
//         Start_Date,
//         Completion_Date,
//         Sanction_Amount,
//         Complete_Pending,
//         Local_Area,
//         Zones,
//         City,
//         Pincode,
//         Locality,
//       } = req.body;

//       const startDate = new Date(Start_Date);
//       const completionDate = new Date(Completion_Date);
//       const Total_Duration_Days = (completionDate - startDate) / (1000 * 3600 * 24);

//       // ✅ Generate unique Tender_ID in controller
//       const lastTender = await AllTenders.findOne({ order: [["id", "DESC"]], transaction });
//       const lastId = lastTender ? parseInt(lastTender.id, 10) : 0;
//       const newTenderID = `TND${String(lastId + 1).padStart(3, "0")}`;

//       console.log("✅ Generated Tender_ID:", newTenderID);

//       // ✅ Save the new tender inside transaction
//       const newTender = await AllTenders.create(
//         {
//           Tender_ID: newTenderID,
//           Tender_by_Department,
//           Tender_by_Classification,
//           Sanction_Date,
//           Start_Date,
//           Completion_Date,
//           Sanction_Amount,
//           Total_Duration_Days,
//           Complete_Pending,
//           Locality,
//           Local_Area,
//           Zones,
//           City,
//           Pincode,
//         },
//         { transaction }
//       );

//       console.log("✅ Tender saved successfully!");

//       // ✅ Check for clashes after adding the tender
//       const clashResponse = await checkClashesNew(Pincode, sequelize);

//       if (Object.keys(clashResponse.clashes_by_locality).length > 0) {
//         console.log("⚠️ Clashes detected! Storing in DB...");
//         await storeClashesInDB(req, res, clashResponse.clashes_by_locality, sequelize);
//       }

//       res.status(201).json({
//         message: "Tender added successfully",
//         tender: newTender,
//         tenderId: newTenderID,
//         clashes: clashResponse.clashes_by_locality,
//         suggestions: clashResponse.suggestions,
//       });
//     });
//   } catch (error) {
//     console.error("❌ Error adding tender:", error);
//     res.status(500).json({
//       message: "Failed to add tender",
//       error: error.message,
//     });
//   }
// };

// Get tender by Tender_ID

exports.addTendermain = async (req, res) => {
  try {
    const { sequelize } = req.app.locals;
    if (!sequelize) {
      console.error("❌ Sequelize is not initialized yet!");
      return res
        .status(500)
        .json({ message: "Database connection not initialized" });
    }

    const { AllTenders, CommonDepts } = sequelize.models;
    if (!AllTenders || !CommonDepts) {
      console.error("❌ Required models are missing!");
      return res.status(500).json({ message: "Database models not found" });
    }

    let newTenderID = null; // Declare in outer scope
    let newTender = null;

    await atwithTransaction(sequelize, async (transaction) => {
      const { deptId } = req.user;
      if (!deptId) {
        throw new Error("Invalid request: deptId missing");
      }

      const commonDept = await CommonDepts.findOne({
        where: { deptId },
        transaction,
      });
      if (!commonDept) {
        throw new Error("Department not found");
      }

      const Tender_by_Department = commonDept.deptName;
      const {
        Tender_by_Classification,
        Sanction_Date,
        Start_Date,
        Completion_Date,
        Sanction_Amount,
        Complete_Pending,
        Local_Area,
        Zones,
        City,
        Pincode,
        Locality,
      } = req.body;

      if (!Pincode) {
        throw new Error("Pincode is required");
      }

      const startDate = new Date(Start_Date);
      const completionDate = new Date(Completion_Date);
      const Total_Duration_Days =
        (completionDate - startDate) / (1000 * 3600 * 24);

      // Generate unique Tender_ID
      const lastTender = await AllTenders.findOne({
        order: [["id", "DESC"]],
        transaction,
      });
      const lastId = lastTender ? parseInt(lastTender.id, 10) : 0;
      newTenderID = `TND${String(lastId + 1).padStart(3, "0")}`;

      console.log("✅ Generated Tender_ID:", newTenderID);

      // Save the new tender inside the transaction
      newTender = await AllTenders.create(
        {
          Tender_ID: newTenderID,
          Tender_by_Department,
          Tender_by_Classification,
          Sanction_Date,
          Start_Date,
          Completion_Date,
          Sanction_Amount,
          Total_Duration_Days,
          Complete_Pending,
          Locality,
          Local_Area,
          Zones,
          City,
          Pincode,
        },
        { transaction }
      );

      console.log("✅ Tender saved successfully!");
    });

    if (newTenderID && newTender) {
      console.log("📌 Checking clashes for Pincode:", newTender.Pincode);
      const clashResponse = await checkClashesNew(sequelize, newTender.Pincode);

      if (Object.keys(clashResponse.clashes_by_locality).length > 0) {
        console.log("⚠️ Clashes detected! Storing in DB...");
        await storeClashesInDB(sequelize, clashResponse.clashes_by_locality);
      }

      return res.status(201).json({
        message: "Tender added successfully",
        tender: newTender,
        tenderId: newTenderID,
        clashes: clashResponse.clashes_by_locality || {},
        suggestions: clashResponse.suggestions || [],
      });
    } else {
      throw new Error("Failed to retrieve newly added tender");
    }
  } catch (error) {
    console.error("❌ Error adding tender:", error);
    res
      .status(500)
      .json({ message: "Failed to add tender", error: error.message });
  }
};

exports.getTenderById = async (req, res) => {
  try {
    const { tenderId } = req.params; // Get Tender_ID from URL
    const { sequelize } = req.app.locals;
    const { AllTenders, CommonDepts } = sequelize.models;

    //get deptId from jwt and find deptNAme and use it in Tender_by_Department
    const { deptId } = req.user;
    if (!deptId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const commonDept = await CommonDepts.findOne({ where: { deptId } });
    // Find tender by Tender_ID
    const tender = await AllTenders.findOne({
      where: { Tender_ID: tenderId , Tender_by_Department: commonDept.deptName},
    });

    // If no tender found
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    // Send response with tender data
    res.status(200).json({ success: true, data: tender });
  } catch (error) {
    console.error("❌ Error fetching tender:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const { type, query } = req.query;

    if (!type || !query) {
      return res.status(400).json({ message: "Invalid request" });
    }

    let results = [];

    if (type === "pincode") {
      results = await CommonPincode.findAll({
        where: { pincode: { [Op.like]: `${query}%` } },
        attributes: ["pincode"],
        limit: 10,
      });
      results = results.map((p) => p.pincode);
    } else if (type === "locality") {
      results = await CommonLocality.findAll({
        where: { locality: { [Op.like]: `${query}%` } },
        attributes: ["locality"],
        limit: 10,
      });
      results = results.map((l) => l.locality);
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// controllers/tenderController.js
const jwt = require("jsonwebtoken");

//get tender by deptID from jwt
exports.getTendersByDeptId = async (req, res) => {
  try {
    const { sequelize } = req.app.locals; // Extract sequelize instance
    const { AllTenders, CommonDepts } = sequelize.models; // Ensure models exist

    // Extract token from request header
    const { deptId } = req.user; // Get deptId from JWT token

    if (!deptId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid token: deptId missing" });
    }

    // Find department name from CommonDepts table using deptId
    const department = await CommonDepts.findOne({ where: { deptId } });

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    const deptName = department.deptName;

    // Find tenders where Tender_by_Department matches deptName
    const tenders = await AllTenders.findAll({
      attributes: [
        "Tender_ID",
        "Tender_by_Department",
        "Tender_by_Classification",
        "Sanction_Date",
        "Sanction_Amount",
        "Complete_Pending",
        "Local_Area",
        "Zones",
        "City",
        "Pincode",
        "Locality",
        [sequelize.literal("COALESCE(updated_startDate, Start_Date)"), "Start_Date"],
        [sequelize.literal("COALESCE(updated_endDate, Completion_Date)"), "End_Date"],
      ],
      where: { Tender_by_Department: deptName },
      order: [["Start_Date", "DESC"]],
    });

    if (!tenders.length) {
      return res.status(404).json({
        success: false,
        message: "No tenders found for this department",
      });
    }

    res.status(200).json({ success: true, data: tenders });
  } catch (error) {
    console.error("❌ Error fetching tenders:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 1️⃣ Get All Tenders
exports.getAllTenders = async (req, res) => {
  try {
    const { sequelize } = req.app.locals;
    const { AllTenders } = sequelize.models;

    const tenders = await AllTenders.findAll({
      attributes: [
        "Tender_ID",
        "Tender_by_Department",
        "Tender_by_Classification",
        "Sanction_Date",
        "Sanction_Amount",
        "Complete_Pending",
        "Local_Area",
        "Zones",
        "City",
        "Pincode",
        "Locality",
        [sequelize.literal("COALESCE(updated_startDate, Start_Date)"), "Start_Date"],
        [sequelize.literal("COALESCE(updated_endDate, Completion_Date)"), "End_Date"],
      ],
      order: [["Start_Date", "DESC"]],
    });

    res.status(200).json({ success: true, data: tenders });
  } catch (err) {
    console.error("❌ Error retrieving tenders:", err);
    res.status(500).json({ message: "Error retrieving tenders", error: err });
  }
};

exports.getAllTendersbyrange = async (req, res) => {
  try {
    const { sequelize } = req.app.locals;
    const { AllTenders } = sequelize.models;
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    // Convert to Date objects
    const userStartDate = new Date(startDate);
    const userEndDate = new Date(endDate);

    if (isNaN(userStartDate) || isNaN(userEndDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // Fetch tenders where the effective start date falls within the user-given range
    const tenders = await AllTenders.findAll({
      attributes: [
        "Tender_ID",
        "Tender_by_Department",
        "Tender_by_Classification",
        "Sanction_Date",
        "Sanction_Amount",
        "Complete_Pending",
        "Local_Area",
        "Zones",
        "City",
        "Pincode",
        "Locality",
        [sequelize.literal("COALESCE(updated_startDate, Start_Date)"), "Start_Date"],
        [sequelize.literal("COALESCE(updated_endDate, Completion_Date)"), "End_Date"],
      ],
      where: sequelize.where(
        sequelize.literal("COALESCE(updated_startDate, Start_Date)"),
        {
          [Op.between]: [userStartDate, userEndDate],
        }
      ),
      order: [["Start_Date", "DESC"]],
    });

    if (!tenders.length) {
      return res.status(404).json({
        success: false,
        message: "No tenders found within the given date range",
      });
    }

    res.status(200).json({ success: true, data: tenders });
  } catch (error) {
    console.error("❌ Error fetching tenders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 2️⃣ Get Tenders by Department Name
exports.getTendersByDepartment = async (req, res) => {
  try {
    const { sequelize } = req.app.locals; // Extract sequelize instance
    const { AllTenders, CommonDepts } = sequelize.models; // Ensure models exist

    // Extract token from request header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: No token provided" });
    }

    // Decode the JWT token to get deptId
    const decoded = jwt.verify(token, "spidermonkey");
    const deptId = decoded.deptId;

    if (!deptId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid token: deptId missing" });
    }

    // Find department name from CommonDepts table using deptId
    const department = await CommonDepts.findOne({ where: { deptId } });

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    const deptName = department.deptName;

    // Find tenders where Tender_by_Department matches deptName
    const tenders = await AllTenders.findAll({
      attributes: [
        "Tender_ID",
        "Tender_by_Department",
        "Tender_by_Classification",
        "Sanction_Date",
        "Sanction_Amount",
        "Complete_Pending",
        "Local_Area",
        "Zones",
        "City",
        "Pincode",
        "Locality",
        [sequelize.literal("COALESCE(updated_startDate, Start_Date)"), "Start_Date"],
        [sequelize.literal("COALESCE(updated_endDate, Completion_Date)"), "End_Date"],
      ],
      where: { Tender_by_Department: deptName },
      order: [["Start_Date", "DESC"]],
    });

    if (!tenders.length) {
      return res.status(404).json({
        success: false,
        message: "No tenders found for this department",
      });
    }

    res.status(200).json({ success: true, data: tenders });
  } catch (err) {
    console.error("❌ Error retrieving tenders:", err);
    res.status(500).json({ message: "Error retrieving tenders", error: err });
  }
};

// 3️⃣ Add Tender (Restricted by Department)
// exports.addTender = async (req, res) => {
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const departmentName = decoded.departmentname;

//     const newTender = await AllTenders.create({ ...req.body, Tender_by_Department: departmentName });
//     res.json({ message: "Tender added successfully", tender: newTender });
//   } catch (err) {
//     res.status(500).json({ message: "Error adding tender", error: err });
//   }
// };

exports.updateTender = async (req, res) => {
  try {
    const { sequelize } = req.app.locals; // Extract sequelize instance
    if (!sequelize) {
      console.error("❌ Sequelize is not initialized yet!");
      return res
        .status(500)
        .json({ message: "Database connection not initialized" });
    }

    const { AllTenders } = sequelize.models; // Ensure the AllTenders model exists
    if (!AllTenders) {
      console.error("❌ AllTenders model is missing!");
      return res.status(500).json({ message: "AllTenders model not found" });
    }

    const { Tender_ID } = req.params; // Extract Tender_ID from request parameters
    if (!Tender_ID) {
      return res.status(400).json({ message: "Tender_ID is required" });
    }

    const {
      Tender_by_Classification,
      Sanction_Date,
      Start_Date,
      Completion_Date,
      Sanction_Amount,
      Complete_Pending,
      Local_Area,
      Zones,
      City,
      Pincode,
      Locality,
    } = req.body; // Extract updated fields from request body

    // Use withTransaction to handle the update operation
    await atwithTransaction(sequelize, async (transaction) => {
      // Find the existing tender
      const existingTender = await AllTenders.findOne({
        where: { Tender_ID },
        transaction,
      });

      if (!existingTender) {
        throw new Error(`Tender with ID ${Tender_ID} not found`);
      }

      // Use the existing Pincode if not provided in the request body
      const updatedPincode = Pincode || existingTender.Pincode;

      // Update the tender with new values (only update fields that are provided)
      await existingTender.update(
        {
          Tender_by_Classification:
            Tender_by_Classification ?? existingTender.Tender_by_Classification,
          Sanction_Date: Sanction_Date ?? existingTender.Sanction_Date,
          Start_Date: Start_Date ?? existingTender.Start_Date,
          Completion_Date: Completion_Date ?? existingTender.Completion_Date,
          Sanction_Amount: Sanction_Amount ?? existingTender.Sanction_Amount,
          Complete_Pending: Complete_Pending ?? existingTender.Complete_Pending,
          Local_Area: Local_Area ?? existingTender.Local_Area,
          Zones: Zones ?? existingTender.Zones,
          City: City ?? existingTender.City,
          Pincode: updatedPincode,
          Locality: Locality ?? existingTender.Locality,
        },
        { transaction }
      );

      console.log(`✅ Tender ${Tender_ID} updated successfully!`);

      // Check for clashes after the update
      console.log("📌 Checking clashes for Pincode:", updatedPincode);
      const clashResponse = await checkClashesNew(sequelize, updatedPincode);

      if (Object.keys(clashResponse.clashes_by_locality).length > 0) {
        console.log("⚠️ Clashes detected! Storing in DB...");
        await storeClashesInDB(sequelize, clashResponse.clashes_by_locality);
      }

      // Return response after transaction is committed
      res.status(200).json({
        message: `Tender ${Tender_ID} updated successfully`,
        tender: existingTender,
        clashes: clashResponse.clashes_by_locality || {},
        suggestions: clashResponse.suggestions || [],
      });
    });
  } catch (error) {
    console.error("❌ Error updating tender:", error);
    res
      .status(500)
      .json({ message: "Failed to update tender", error: error.message });
  }
};

// 5️⃣ Delete Tender (Only by Department)
exports.deleteTender = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const departmentName = decoded.departmentname;
    const { id } = req.params;

    const tender = await AllTenders.findOne({
      where: { id, Tender_by_Department: departmentName },
    });
    if (!tender) return res.status(403).json({ message: "Not authorized" });

    await tender.destroy();
    res.json({ message: "Tender deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting tender", error: err });
  }
};
