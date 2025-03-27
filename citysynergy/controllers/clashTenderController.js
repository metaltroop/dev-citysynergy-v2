const { QueryTypes, Op } = require("sequelize");
const Clashes = require("../models/Clashes");
const CommonDepts = require("../models/common_dept");
const {withTransaction}=require('../utils/transactionManager')

const DEPARTMENT_PRIORITY = {
  "Disaster Management Authority": 1,
  "Water Supply and Sewerage Board": 2,
  "Sanitation and Waste Management Department": 3,
  "Gas Pipeline Department": 4,
  "Electricity Department": 5,
  "Road and Transport Department": 6,
  "Telecommunication Department": 7,
  "Urban Development Authority": 8,
  "Municipal Corporation": 9,
  "Public Works Department": 10,
};

// ✅ Fetch all tenders by Pincode
const fetchTendersByPincode = async (pincode, sequelize) => {
  try {
    if (!pincode) throw new Error("Pincode is required");

    const tenders = await sequelize.query(
      `SELECT Tender_ID, Pincode, Locality, 
              Tender_By_Department, Start_Date, Completion_Date 
       FROM All_Tenders WHERE Pincode = ?`,
      { replacements: [pincode], type: QueryTypes.SELECT }
    );

    console.log("Fetched tenders:", tenders.length, "tenders found");
    return tenders;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

// ✅ Function to calculate overlap days
const calculateDateOverlap = (start1, end1, start2, end2) => {
  const latestStart = new Date(Math.max(new Date(start1), new Date(start2)));
  const earliestEnd = new Date(Math.min(new Date(end1), new Date(end2)));
  return Math.max(0, (earliestEnd - latestStart) / (1000 * 60 * 60 * 24));
};

// ✅ Generate work order suggestions based on priority
const generateSuggestions = (clashesByLocality) => {
  let suggestions = [];
  let workflowByLocality = {};

  for (const [locality, clashes] of Object.entries(clashesByLocality)) {
    if (!Array.isArray(clashes) || clashes.length === 0) continue;

    // ✅ Sort by start date first, then by department priority
    const sortedClashes = clashes.sort((a, b) => {
      const dateDiff = new Date(a.tender_start_date) - new Date(b.tender_start_date);
      if (dateDiff !== 0) return dateDiff; // Sort by start date first
      return DEPARTMENT_PRIORITY[a.department] - DEPARTMENT_PRIORITY[b.department]; // Then by priority
    });

    // ✅ Generate work sequence
    const workSequence = [...new Set(sortedClashes.flatMap(clash => [clash.tender_id, clash.clashing_tender_id]))];

    if (workSequence.length > 0) {
      suggestions.push(`In ${locality}, reorder work as follows: ${workSequence.join(" -> ")}`);
      workflowByLocality[locality] = workSequence;
    }
  }

  return { suggestions, workflowByLocality };
};


// ✅ Function to check for all tender clashes
const checkClashesNew = async (pincode, sequelize) => {
  try {
    if (!pincode) throw new Error("Pincode is required");

    const tenders = await fetchTendersByPincode(pincode, sequelize);
    if (tenders.length === 0) {
      return { message: "No tenders found for this pincode", clashes_by_locality: {}, suggestions: [] };
    }

    let clashesByLocality = {};

    for (let i = 0; i < tenders.length; i++) {
      for (let j = 0; j < tenders.length; j++) {
        if (i !== j) {
          let tender = tenders[i];
          let otherTender = tenders[j];

          if (tender.Locality === otherTender.Locality) {
            let overlapDays = calculateDateOverlap(
              tender.Start_Date,
              tender.Completion_Date,
              otherTender.Start_Date,
              otherTender.Completion_Date
            );

            if (overlapDays > 0) {
              if (!clashesByLocality[tender.Locality]) {
                clashesByLocality[tender.Locality] = [];
              }

              // ✅ Check if this clash is already stored (avoid duplicates)
              let clashExists = clashesByLocality[tender.Locality].some(
                (clash) =>
                  (clash.tender_id === tender.Tender_ID && clash.clashing_tender_id === otherTender.Tender_ID) ||
                  (clash.tender_id === otherTender.Tender_ID && clash.clashing_tender_id === tender.Tender_ID)
              );

              if (!clashExists) {
                clashesByLocality[tender.Locality].push({
                  tender_id: tender.Tender_ID,
                  clashing_tender_id: otherTender.Tender_ID,
                  Locality: tender.Locality,
                  overlap_days: overlapDays,
                  department: tender.Tender_By_Department,
                  clashing_department: otherTender.Tender_By_Department,
                });
              }
            }
          }
        }
      }
    }

    // ✅ Generate work order suggestions
    const { suggestions, workflowByLocality } = generateSuggestions(clashesByLocality);

    console.log("Detected Clashes:", JSON.stringify(clashesByLocality, null, 2));
    console.log("Generated Suggestions:", suggestions);

    return { clashes_by_locality: clashesByLocality, suggestions, workflowByLocality };
  } catch (error) {
    console.error("Error processing request:", error);
    return { error: "Internal Server Error" };
  }
};

const storeClashesInDB = async (req, res, clashesByLocality) => {
  try {
    await withTransaction(async (transaction) => {
      const { sequelize } = req.app.locals;
      const { Clashes, AllTenders, CommonDepts } = sequelize.models;

      if (!Clashes || !AllTenders || !CommonDepts) {
        console.error("❌ Missing models in Sequelize!");
        return;
      }

      let clashCount = await Clashes.count({ transaction });

      for (const [locality, clashes] of Object.entries(clashesByLocality)) {
        for (const clash of clashes) {
          // Fetch tender details
          const tender1 = await AllTenders.findOne({
            where: { Tender_ID: clash.tender_id },
            attributes: ["Start_Date", "Completion_Date", "Tender_by_Department"],
            transaction,
          });

          const tender2 = await AllTenders.findOne({
            where: { Tender_ID: clash.clashing_tender_id },
            attributes: ["Start_Date", "Completion_Date", "Tender_by_Department"],
            transaction,
          });

          if (!tender1 || !tender2) {
            console.warn(`⚠️ Tenders not found: ${clash.tender_id}, ${clash.clashing_tender_id}`);
            continue;
          }

          // Fetch department IDs
          const dept1 = await CommonDepts.findOne({
            where: { deptName: tender1.Tender_by_Department },
            attributes: ["deptId"],
            transaction,
          });

          const dept2 = await CommonDepts.findOne({
            where: { deptName: tender2.Tender_by_Department },
            attributes: ["deptId"],
            transaction,
          });

          if (!dept1 || !dept2) {
            console.warn(`⚠️ Departments not found for tenders: ${clash.tender_id}, ${clash.clashing_tender_id}`);
            continue;
          }

          let involvedDepartments = {};
          involvedDepartments[dept1.deptId] = false;
          involvedDepartments[dept2.deptId] = false;

          let startDates = {};
          let endDates = {};
          startDates[dept1.deptId] = tender1.Start_Date;
          startDates[dept2.deptId] = tender2.Start_Date;
          endDates[dept1.deptId] = tender1.Completion_Date;
          endDates[dept2.deptId] = tender2.Completion_Date;

          // Check if the clash already exists
          const existingClash = await Clashes.findOne({
            where: {
              involved_departments: JSON.stringify(involvedDepartments),
            },
            transaction,
          });

          if (existingClash) {
            console.log(`⚠️ Clash already exists, skipping...`);
            continue;
          }

          // Generate unique clash ID
          const clashID = `clash${(clashCount + 1).toString().padStart(3, "0")}`;

          await Clashes.create({
            clashID,
            involved_departments: JSON.stringify(involvedDepartments),
            start_dates: JSON.stringify(startDates),
            end_dates: JSON.stringify(endDates),
            is_resolved: false,
          }, { transaction });

          clashCount++;
          console.log(`✅ Clash stored: ${clashID} | Departments: ${Object.keys(involvedDepartments).join(", ")}`);
        }
      }
    });
  } catch (error) {
    console.error("❌ Error storing clashes in DB:", error);
  }
};


const processExistingClashesOnStartup = async (sequelize) => {
  try {
    const { Clashes, AllTenders, CommonDepts } = sequelize.models;

    if (!Clashes || !AllTenders || !CommonDepts) {
      console.error("❌ Missing models in Sequelize!");
      return;
    }

    console.log("🔄 Processing existing clashes on startup...");

    const allTenders = await AllTenders.findAll({
      attributes: ["Tender_ID", "Start_Date", "Completion_Date", "Tender_by_Department", "Locality"],
    });

    let clashCount = await Clashes.count();
    let newClashes = [];

    for (let i = 0; i < allTenders.length; i++) {
      for (let j = i + 1; j < allTenders.length; j++) {
        const tender1 = allTenders[i];
        const tender2 = allTenders[j];

        // Only check tenders in the same locality
        if (tender1.Locality !== tender2.Locality) continue;

        // Check date overlap
        const start1 = new Date(tender1.Start_Date);
        const end1 = new Date(tender1.Completion_Date);
        const start2 = new Date(tender2.Start_Date);
        const end2 = new Date(tender2.Completion_Date);

        if (start1 <= end2 && start2 <= end1) {
          // Fetch department IDs
          const dept1 = await CommonDepts.findOne({
            where: { deptName: tender1.Tender_by_Department },
            attributes: ["deptId"],
          });

          const dept2 = await CommonDepts.findOne({
            where: { deptName: tender2.Tender_by_Department },
            attributes: ["deptId"],
          });

          if (!dept1 || !dept2) continue;

          let involvedDepartments = {};
          involvedDepartments[dept1.deptId] = false;
          involvedDepartments[dept2.deptId] = false;

          let startDates = {};
          let endDates = {};
          startDates[dept1.deptId] = tender1.Start_Date;
          startDates[dept2.deptId] = tender2.Start_Date;
          endDates[dept1.deptId] = tender1.Completion_Date;
          endDates[dept2.deptId] = tender2.Completion_Date;

          // Check if the clash already exists
          const existingClash = await Clashes.findOne({
            where: {
              involved_departments: JSON.stringify(involvedDepartments),
            },
          });

          if (!existingClash) {
            const clashID = `clash${(clashCount + 1).toString().padStart(3, "0")}`;
            newClashes.push({
              clashID,
              involved_departments: JSON.stringify(involvedDepartments),
              start_dates: JSON.stringify(startDates),
              end_dates: JSON.stringify(endDates),
              is_resolved: false,
            });
            clashCount++;
          }
        }
      }
    }

    if (newClashes.length > 0) {
      await Clashes.bulkCreate(newClashes);
      console.log(`✅ Stored ${newClashes.length} new clashes.`);
    } else {
      console.log("✅ No new clashes detected.");
    }
  } catch (error) {
    console.error("❌ Error processing existing clashes:", error);
  }
};

// ✅ API route to check for clashes
const checkClashesNewHandler = async (req, res) => {
  try {
    const { pincode } = req.body;
    if (!pincode) {
      return res.status(400).json({ message: "Pincode is required" });
    }

    const { sequelize } = req.app.locals; // ✅ Extract sequelize

    const clashData = await checkClashesNew(pincode, sequelize); // ✅ Get all clashes
    res.json(clashData);
  } catch (error) {
    res.status(500).json({ message: "Failed to check clashes", error: error.message });
  }
};

const getClashesByDeptId = async (req, res) => {
  try {
    // Extract deptId from JWT token
    const { deptId } = req.user; // req.user is set by the authentication middleware

    if (!deptId) {
      return res.status(403).json({ message: "Unauthorized: No department assigned" });
    }

    const { sequelize } = req.app.locals;
    const { Clashes } = sequelize.models;

    // Fetch clashes where the department is involved
    const clashes = await Clashes.findAll({
      where: sequelize.literal(`JSON_CONTAINS(involved_departments, '"${deptId}"', '$')`),
      attributes: ["clashID", "involved_departments", "start_dates", "end_dates", "is_resolved"],
    });

    if (clashes.length === 0) {
      return res.status(404).json({ message: "No clashes found for the given department ID" });
    }

    res.status(200).json({ clashes });
  } catch (error) {
    console.error("❌ Error fetching clashes by deptId:", error);
    res.status(500).json({ message: "Failed to fetch clashes", error: error.message });
  }
};

const getClashIdByDeptId = async (req, res) => {
  try {
    // Extract deptId from JWT token
    const { deptId } = req.user; // Extracted from JWT middleware

    // Log the extracted deptId
    console.log(`✅ Extracted deptId from token: ${deptId}`);

    if (!deptId) {
      console.error("❌ Unauthorized: No department assigned in token");
      return res.status(403).json({ message: "Unauthorized: No department assigned" });
    }

    const { sequelize } = req.app.locals;
    const { Clashes } = sequelize.models;

    // Log the query being executed
    console.log(`Executing query: SELECT * FROM Clashes WHERE JSON_CONTAINS(involved_departments, '"${deptId}"', '$')`);

    // Fetch clashes where the department is involved
    const clashes = await Clashes.findAll({
      where: sequelize.literal(`JSON_CONTAINS(involved_departments, '"${deptId}"', '$')`),
      attributes: ["clashID", "involved_departments", "start_dates", "end_dates", "is_resolved"],
    });

    // Log the raw result
    console.log(`✅ Raw result from database for deptId ${deptId}:`, clashes);

    // Fallback: Filter results in JavaScript if JSON_CONTAINS fails
    if (clashes.length === 0) {
      console.warn(`⚠️ No clashes found using JSON_CONTAINS. Attempting fallback filtering for deptId: ${deptId}`);

      const allClashes = await Clashes.findAll({
        attributes: ["clashID", "involved_departments", "start_dates", "end_dates", "is_resolved"],
      });

      const filteredClashes = allClashes.filter((clash) => {
        const involvedDepartments = clash.involved_departments;
        return involvedDepartments && involvedDepartments[deptId] !== undefined;
      });

      if (filteredClashes.length === 0) {
        console.warn(`⚠️ No clashes found for deptId: ${deptId} even after fallback filtering`);
        return res.status(404).json({ message: "No clashes found for the given department ID" });
      }

      console.log(`✅ Fallback filtering result for deptId ${deptId}:`, filteredClashes);
      return res.status(200).json({ success: true, clashes: filteredClashes });
    }

    res.status(200).json({ success: true, clashes });
  } catch (error) {
    console.error("❌ Error fetching clash IDs by deptId:", error);
    res.status(500).json({ message: "Failed to fetch clash IDs", error: error.message });
  }
};

const getInvolvedDeptStatus = async (req, res) => {
  try {
    const { clashID } = req.params;

    if (!clashID) {
      return res.status(400).json({ message: "clashID is required" });
    }

    const { sequelize } = req.app.locals;
    const { Clashes } = sequelize.models;

    // Fetch the clash by clashID
    const clash = await Clashes.findOne({
      where: { clashID },
      attributes: ["clashID", "involved_departments"],
    });

    if (!clash) {
      return res.status(404).json({ message: "Clash not found for the given clashID" });
    }

    res.status(200).json({ success: true, clashID: clash.clashID, involved_departments: clash.involved_departments });
  } catch (error) {
    console.error("❌ Error fetching involved department status:", error);
    res.status(500).json({ message: "Failed to fetch involved department status", error: error.message });
  }
};

const updateInvolvedDeptStatus = async (req, res) => {
  try {
    const { clashID } = req.params;
    const { deptId, status } = req.body;

    if (!clashID || !deptId || typeof status !== "boolean") {
      return res.status(400).json({ message: "clashID, deptId, and status (boolean) are required" });
    }

    const { sequelize } = req.app.locals;
    const { Clashes } = sequelize.models;

    // Fetch the clash by clashID
    const clash = await Clashes.findOne({
      where: { clashID },
      attributes: ["clashID", "involved_departments"],
    });

    if (!clash) {
      return res.status(404).json({ message: "Clash not found for the given clashID" });
    }

    // ✅ Ensure involved_departments is properly parsed from JSON
    let involvedDepartments = clash.involved_departments;
    if (typeof involvedDepartments === "string") {
      involvedDepartments = JSON.parse(involvedDepartments);
    }

    // ✅ Check if the department exists in involved_departments
    if (!involvedDepartments || !(deptId in involvedDepartments)) {
      return res.status(404).json({ message: `Department ${deptId} not found in involved_departments` });
    }

    // ✅ Ensure the status cannot be undone
    if (involvedDepartments[deptId] === true) {
      return res.status(400).json({ message: `Status for department ${deptId} has already been updated and cannot be undone` });
    }

    // ✅ Update the status of the department
    involvedDepartments[deptId] = status;

    // ✅ Save the updated involved_departments (convert to string before saving)
    await Clashes.update(
      { involved_departments: JSON.stringify(involvedDepartments) },
      { where: { clashID } }
    );

    res.status(200).json({
      success: true,
      message: `Status updated for department ${deptId}`,
      involved_departments: involvedDepartments,
    });
  } catch (error) {
    console.error("❌ Error updating involved department status:", error);
    res.status(500).json({
      message: "Failed to update involved department status",
      error: error.message,
    });
  }
};


module.exports = { checkClashesNew,processExistingClashesOnStartup, checkClashesNewHandler, storeClashesInDB,getClashesByDeptId,getClashIdByDeptId, getInvolvedDeptStatus ,updateInvolvedDeptStatus};
