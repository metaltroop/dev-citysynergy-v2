const { QueryTypes, Op } = require("sequelize");
const activityLogService = require("../services/activityLogService");

const DEPARTMENT_PRIORITY = {
  "Disaster Management Authority": 1,
  "Dept. Of Waterworks": 2,
  "Gas Pipeline Department": 3,
  "dept. of road works ": 4,
  "Dept. of Electricity": 5,
  "Sanitation and Waste Management Department": 6,
  "Telecommunication Department": 7,
  "Urban Development Authority": 8,
  "Municipal Corporation": 9,
  "Public Works Department": 10,
  "dept test":11,
  "dept test 2":12,
};

/**
 * Fetch tenders based on pincode
 */
const fetchTendersByPincode = async (sequelize, pincode) => {
  try {
    if (!pincode) throw new Error("Pincode is required");

    const { AllTenders } = sequelize.models;

    const results = await AllTenders.findAll({
      where: { pincode },
      attributes: [
        "Tender_ID",
        "pincode",
        "Locality",
        "Tender_by_Department",
        [sequelize.literal("COALESCE(updated_startDate, Start_Date)"), "effective_start_date"],
        [sequelize.literal("COALESCE(updated_endDate, Completion_Date)"), "effective_end_date"],
        "Start_Date",
        "Completion_Date",
        "updated_startDate",
        "updated_endDate"
      ],
    });
    console.log("founde tenders " + results.length);

    return results.map(tender => tender.get({ plain: true }));
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Calculate date overlap between two tenders
 */
const calculateDateOverlap = (start1, end1, start2, end2) => {
  const latestStart = new Date(Math.max(new Date(start1), new Date(start2)));
  const earliestEnd = new Date(Math.min(new Date(end1), new Date(end2)));
  return Math.max(0, (earliestEnd - latestStart) / (1000 * 60 * 60 * 24));
};

/**
 * Determine if a priority issue exists between two departments
 */const isPriorityIssue = (dept1, dept2) => {
  const priority1 = DEPARTMENT_PRIORITY[dept1] || Number.MAX_SAFE_INTEGER;
  const priority2 = DEPARTMENT_PRIORITY[dept2] || Number.MAX_SAFE_INTEGER;
  
  console.log(`🔍 Checking priorities - ${dept1}(${priority1}) vs ${dept2}(${priority2})`);
  
  // Return true if the dates overlap and departments are different
  return priority1 !== priority2;
};

/**
 * Generate work sequence suggestions for avoiding clashes
 */
const generateSuggestions = (clashesByLocality) => {
  let suggestions = [];
  let workflowByLocality = {};

  for (const [locality, clashes] of Object.entries(clashesByLocality)) {
    if (!Array.isArray(clashes) || clashes.length === 0) continue;

    const sortedClashes = clashes.sort(
      (a, b) =>
        DEPARTMENT_PRIORITY[a.department] - DEPARTMENT_PRIORITY[b.department]
    );

    const workSequence = [
      ...new Set(
        sortedClashes.flatMap((clash) => [
          clash.tender_id,
          clash.clashing_tender_id,
        ])
      ),
    ];

    if (workSequence.length > 0) {
      suggestions.push(
        `In ${locality}, reorder work as follows: ${workSequence.join(" -> ")}`
      );
      workflowByLocality[locality] = workSequence;
    }
  }

  return { suggestions, workflowByLocality };
};

/**
 * Check tender clashes by pincode
 */
const checkClashesNew = async (sequelize, pincode) => {
  try {
    console.log(`🔍 Starting clash detection for pincode: ${pincode}`);
    
    const tenders = await fetchTendersByPincode(sequelize, pincode);
    console.log(`📋 Found ${tenders.length} tenders for analysis`);
    
    const { Clashes } = sequelize.models;
    
    // Get existing clashes to avoid duplicates
    const existingClashes = await Clashes.findAll({
      attributes: ['involved_tenders']
    });
    console.log(`ℹ️ Found ${existingClashes.length} existing clashes in database`);

    const existingClashPairs = new Set(
      existingClashes.flatMap(clash => {
        const tenders = clash.involved_tenders;
        return tenders.map((t1, i) => 
          tenders.slice(i + 1).map(t2 => 
            [t1, t2].sort().join('_')
          )
        ).flat();
      })
    );
    console.log(`🔄 Number of existing clash pairs: ${existingClashPairs.size}`);

    const clashes_by_locality = {};

    for (let i = 0; i < tenders.length; i++) {
      for (let j = i + 1; j < tenders.length; j++) {
        const tender1 = tenders[i];
        const tender2 = tenders[j];

        // Create unique pair ID
        const pairId = [tender1.Tender_ID, tender2.Tender_ID].sort().join('_');
        
        console.log(`\n🔄 Checking pair: ${tender1.Tender_ID} vs ${tender2.Tender_ID}`);
        console.log(`📅 Dates T1: ${tender1.effective_start_date} to ${tender1.effective_end_date}`);
        console.log(`📅 Dates T2: ${tender2.effective_start_date} to ${tender2.effective_end_date}`);

        // Skip if this exact pair is already in an existing clash
        if (existingClashPairs.has(pairId)) {
          console.log(`⏭️ Skipping existing clash pair: ${pairId}`);
          continue;
        }

        // Use effective dates for clash detection
        const hasOverlap = calculateDateOverlap(
          new Date(tender1.effective_start_date),
          new Date(tender1.effective_end_date),
          new Date(tender2.effective_start_date),
          new Date(tender2.effective_end_date)
        );
        
        console.log(`📊 Date overlap: ${hasOverlap} days`);
        console.log(`🏢 Departments: ${tender1.Tender_by_Department} vs ${tender2.Tender_by_Department}`);

        if (hasOverlap && isPriorityIssue(tender1.Tender_by_Department, tender2.Tender_by_Department)) {
          console.log(`⚠️ Clash detected! Overlap: ${hasOverlap} days`);
          
          if (!clashes_by_locality[tender1.Locality]) {
            clashes_by_locality[tender1.Locality] = [];
          }

          clashes_by_locality[tender1.Locality].push({
            tender_id: tender1.Tender_ID,
            clashing_tender_id: tender2.Tender_ID,
            Locality: tender1.Locality,
            overlap_days: hasOverlap,
            department: tender1.Tender_by_Department,
            clashing_department: tender2.Tender_by_Department,
            tender_start_date: tender1.effective_start_date,
            tender_end_date: tender1.effective_end_date,
            clashing_tender_start_date: tender2.effective_start_date,
            clashing_tender_end_date: tender2.effective_end_date,
          });
          
          console.log(`✅ Clash recorded for locality: ${tender1.Locality}`);
        } else {
          console.log('👍 No clash detected for this pair');
        }
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`Found clashes in ${Object.keys(clashes_by_locality).length} localities`);
    for (const [locality, clashes] of Object.entries(clashes_by_locality)) {
      console.log(`${locality}: ${clashes.length} clashes`);
    }

    return { clashes_by_locality };
  } catch (error) {
    console.error("❌ Error in checkClashesNew:", error);
    throw error;
  }
};

/**
 * Store clashes in the database
 */

const storeClashesInDB = async (sequelize, clashesByLocality) => {
  try {
    const { Clashes, CommonDepts, AllTenders } = sequelize.models;
    const existingClashes = await Clashes.findAll();

    const getNextClashID = async () => {
      const lastClash = await Clashes.findOne({
        order: [["clashID", "DESC"]],
        attributes: ["clashID"],
      });

      if (!lastClash) return "Clash001";

      const lastID = lastClash.clashID.match(/\d+/);
      const nextNumber = lastID
        ? String(Number(lastID[0]) + 1).padStart(3, "0")
        : "001";
      return `Clash${nextNumber}`;
    };

    for (const [locality, clashes] of Object.entries(clashesByLocality)) {
      if (!locality || locality.trim() === "") {
        console.error("❌ Error: Locality is missing or empty. Skipping...");
        continue;
      }

      let involvedDepartments = {};
      let involvedTenders = new Set();
      let startDates = {};
      let endDates = {};

      for (const clash of clashes) {
        if (!clash.department || !clash.clashing_department) {
          console.warn(
            `⚠️ Missing department in clash for ${locality}. Skipping...`
          );
          continue;
        }

        const departmentNames = [clash.department, clash.clashing_department]
          .filter((name) => name)
          .map((name) => name.trim().toLowerCase());

        if (departmentNames.length < 2) {
          console.warn(
            `⚠️ Not enough valid departments in ${locality}. Skipping...`
          );
          continue;
        }

        const deptRecords = await CommonDepts.findAll({
          where: { deptName: { [Op.in]: departmentNames } },
          attributes: ["deptId", "deptName"],
        });

        if (deptRecords.length < 2) {
          console.warn(
            `⚠️ Missing department records for ${locality}: ${departmentNames}`
          );
          continue;
        }

        deptRecords.forEach((dept) => {
          if (!involvedDepartments[dept.deptId]) {
            involvedDepartments[dept.deptId] = false;
          }
        });

        involvedTenders.add(clash.tender_id);
        involvedTenders.add(clash.clashing_tender_id);

        const tenderRecords = await AllTenders.findAll({
          where: {
            Tender_ID: { [Op.in]: [clash.tender_id, clash.clashing_tender_id] },
          },
          attributes: [
            "Tender_ID",
            "Start_Date",
            "Completion_Date",
            "Tender_by_Department",
          ],
        });

        let tenderData = [];

        for (const tender of tenderRecords) {
          if (!tender.Tender_by_Department) {
            console.warn(
              `⚠️ Tender ${tender.Tender_ID} has no department! Skipping...`
            );
            continue;
          }

          const tenderDept = deptRecords.find(
            (dept) =>
              dept.deptName.toLowerCase() ===
              tender.Tender_by_Department.toLowerCase()
          );

          if (!tenderDept) {
            console.warn(
              `⚠️ No matching deptId for Tender ${tender.Tender_ID}`
            );
            continue;
          }

          tenderData.push({
            deptId: tenderDept.deptId,
            startDate: new Date(tender.Start_Date),
            endDate: new Date(tender.Completion_Date),
            duration:
              (new Date(tender.Completion_Date) - new Date(tender.Start_Date)) /
              (1000 * 60 * 60 * 24),
          });
        }

        tenderData.sort(
          (a, b) =>
            (DEPARTMENT_PRIORITY[a.deptId] || 99) -
            (DEPARTMENT_PRIORITY[b.deptId] || 99)
        );

        let prevEndDate = null;
        for (let tender of tenderData) {
          if (prevEndDate) {
            tender.startDate = new Date(prevEndDate);
            tender.startDate.setDate(tender.startDate.getDate() + 1);
          }
          tender.endDate = new Date(tender.startDate);
          tender.endDate.setDate(tender.startDate.getDate() + tender.duration);

          startDates[tender.deptId] = tender.startDate
            .toISOString()
            .split("T")[0];
          endDates[tender.deptId] = tender.endDate.toISOString().split("T")[0];

          prevEndDate = tender.endDate;
        }
      }


      if (Object.keys(involvedDepartments).length > 1) {
        let existingUnresolvedClash = existingClashes.find(
          (clash) => clash.Locality === locality && !clash.is_resolved
        );

        let existingResolvedClashes = existingClashes.filter(
          (clash) => clash.Locality === locality && clash.is_resolved
        );

        if (existingUnresolvedClash) {
          console.log(`🔄 Updating unresolved clash: ${existingUnresolvedClash.clashID}`);

          let existingDepartments = existingUnresolvedClash.involved_departments || {};
          let existingTenders = new Set(existingUnresolvedClash.involved_tenders || []);

          // Merge all departments from involvedDepartments into existingDepartments
          let updatedDepartments = { ...existingDepartments };
          Object.keys(involvedDepartments).forEach((deptId) => {
            if (!(deptId in updatedDepartments)) {
              updatedDepartments[deptId] = false;
            }
          });

          console.log("Before update, updatedDepartments:", updatedDepartments);
          console.log("involvedDepartments:", involvedDepartments);

          let tendersInResolvedClashes = new Set();
          existingResolvedClashes.forEach((clash) => {
            clash.involved_tenders.forEach((tender) => tendersInResolvedClashes.add(tender));
          });

          const newTenders = [...involvedTenders].filter(
            (tender) => !existingTenders.has(tender) && !tendersInResolvedClashes.has(tender)
          );

          if (newTenders.length > 0 || Object.keys(updatedDepartments).length !== Object.keys(existingDepartments).length) {
            newTenders.forEach((tender) => existingTenders.add(tender));

            await existingUnresolvedClash.update({
              involved_departments: { ...updatedDepartments }, // force a new object
              involved_tenders: [...existingTenders],
              start_dates: startDates,
              end_dates: endDates,
            });

            console.log(`✅ Updated Clash ${existingUnresolvedClash.clashID}`);

            // Log clash update
            await activityLogService.createActivityLog(sequelize, {
              activityType: 'CH_UPD',
              description: `Clash ${existingUnresolvedClash.clashID} updated with new tenders or departments`,
              metadata: {
                clashId: existingUnresolvedClash.clashID,
                locality,
                newTenders: [...involvedTenders],
                departments: Object.keys(updatedDepartments)
              }
            });
          }
        } else {
          const newClashID = await getNextClashID();
          console.log(`🆕 Creating new clash: ${newClashID}`);
          await Clashes.create({
            clashID: newClashID,
            Locality: locality,
            involved_departments: involvedDepartments,
            involved_tenders: [...involvedTenders],
            start_dates: startDates,
            end_dates: endDates,
            is_resolved: false,
          });

          // Log new clash creation
          await activityLogService.createActivityLog(sequelize, {
            activityType: 'CLASH_DETECTED',
            description: `New clash ${newClashID} detected in ${locality}`,
            metadata: {
              clashId: newClashID,
              locality,
              tenders: [...involvedTenders],
              departments: Object.keys(involvedDepartments)
            }
          });
        }
      }

    }
    console.log("✅ All detected clashes stored successfully.");
  } catch (error) {
    console.error("❌ Error storing clashes in DB:", error);
  }
};

const checkClashesNewHandler = async (req, res) => {
  const { sequelize } = req.app.locals;
  if (!sequelize) {
    console.error("❌ Sequelize instance is missing!");
    return res.status(500).json({ message: "Database connection issue" });
  }

  const { pincode } = req.body;
  const clashData = await checkClashesNew(sequelize, pincode);
  res.json(clashData);
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
      attributes: [
        "clashID",
        "involved_departments",
        "start_dates",
        "end_dates",
      ],
    });

    if (!clash) {
      return res
        .status(404)
        .json({ message: "Clash not found for the given clashID" });
    }

    res.status(200).json({
      success: true,
      clashID: clash.clashID,
      involved_departments: clash.involved_departments,
      start_dates: clash.start_dates, // Returning start dates
      end_dates: clash.end_dates, // Returning end dates
    });
  } catch (error) {
    console.error("❌ Error fetching involved department status:", error);
    res.status(500).json({
      message: "Failed to fetch involved department status",
      error: error.message,
    });
  }
};

const updateInvolvedDeptStatus = async (req, res) => {
  try {
    const { clashID } = req.params;
    const { deptId } = req.user;
    const { status } = req.body;

    if (!clashID || !deptId || typeof status !== "boolean") {
      return res.status(400).json({
        message: "clashID, deptId, and status (boolean) are required",
      });
    }

    const { sequelize } = req.app.locals;
    const { Clashes, AllTenders, CommonDepts } = sequelize.models;

    // Fetch the clash by clashID
    const clash = await Clashes.findOne({
      where: { clashID },
      attributes: ["clashID", "involved_departments", "is_resolved", "involved_tenders", "start_dates", "end_dates"],
    });

    if (!clash) {
      return res.status(404).json({ message: "Clash not found for the given clashID" });
    }

    let involvedDepartments = clash.involved_departments;

    // Check if the department exists in involved_departments
    if (!involvedDepartments || !(deptId in involvedDepartments)) {
      return res.status(404).json({
        message: `Department ${deptId} not found in involved_departments`,
      });
    }

    // Ensure the status cannot be undone
    if (involvedDepartments[deptId] === true) {
      return res.status(400).json({
        message: `Status for department ${deptId} has already been updated and cannot be undone`,
      });
    }

    // Update the status of the department
    involvedDepartments[deptId] = status;

    // Check if all departments have status `true`
    const allResolved = Object.values(involvedDepartments).every(
      (val) => val === true
    );

    // If clash becomes resolved, update the tender dates
    if (allResolved) {
      const { start_dates, end_dates, involved_tenders } = clash;

      // Update dates for each involved tender
      for (const tenderId of involved_tenders) {
        const tenderRecord = await AllTenders.findOne({
          where: { Tender_ID: tenderId },
          attributes: ["Tender_ID", "Tender_by_Department"],
        });

        if (tenderRecord && tenderRecord.Tender_by_Department) {
          const matchedDept = await CommonDepts.findOne({
            where: {
              deptName: { [Op.like]: tenderRecord.Tender_by_Department.trim() },
            },
            attributes: ["deptId"],
          });

          if (matchedDept) {
            const deptId = matchedDept.deptId;
            const updatedStartDate = start_dates[deptId];
            const updatedEndDate = end_dates[deptId];

            if (updatedStartDate && updatedEndDate) {
              await AllTenders.update(
                {
                  updated_startDate: updatedStartDate,
                  updated_endDate: updatedEndDate,
                },
                {
                  where: { Tender_ID: tenderId },
                }
              );
              console.log(
                `✅ Updated Tender ${tenderId}: ${updatedStartDate} → ${updatedEndDate}`
              );
            }
          }
        }
      }

      // Log clash resolution
      await activityLogService.createActivityLog(sequelize, {
        activityType: 'CLASH_RESOLVED',
        description: `Clash ${clashID} has been resolved`,
        userId: req.user.uuid,
        deptId: deptId,
        metadata: {
          clashId: clashID,
          locality: clash.Locality,
          tenders: clash.involved_tenders,
          departments: Object.keys(clash.involved_departments)
        }
      });
    }

    // Update clash record
    await Clashes.update(
      {
        involved_departments: involvedDepartments,
        is_resolved: allResolved ? 1 : 0,
      },
      { where: { clashID } }
    );

    res.status(200).json({
      success: true,
      message: `Status updated for department ${deptId}`,
      involved_departments: involvedDepartments,
      is_resolved: allResolved,
    });
  } catch (error) {
    console.error("❌ Error updating involved department status:", error);
    res.status(500).json({
      message: "Failed to update involved department status",
      error: error.message,
    });
  }
};

const getClashesByDeptId = async (req, res) => {
  try {
    const { deptId } = req.user;

    if (!deptId) {
      return res
        .status(403)
        .json({ message: "Unauthorized: No department assigned" });
    }

    const { sequelize } = req.app.locals;
    const { Clashes, AllTenders } = sequelize.models;

    // Fetch clashes where the department is involved
    const clashes = await Clashes.findAll({
      where: sequelize.literal(
        `JSON_KEYS(involved_departments) LIKE '%"${deptId}"%'`
      ),
      attributes: [
        "clashID",
        "locality",
        "involved_departments",
        "start_dates",
        "end_dates",
        "involved_tenders",
        "is_resolved",
      ],
    });

    if (clashes.length === 0) {
      return res
        .status(404)
        .json({ message: "No clashes found for the given department ID" });
    }

    // For resolved clashes, fetch additional tender details including updated dates
    const enhancedClashes = await Promise.all(
      clashes.map(async (clash) => {
        const clashData = clash.get({ plain: true });

        if (clashData.is_resolved) {
          // Fetch tender details for involved tenders
          const tenderDetails = await AllTenders.findAll({
            where: {
              Tender_ID: { [Op.in]: clashData.involved_tenders },
            },
            attributes: [
              "Tender_ID",
              "Start_Date",
              "Completion_Date",
              "updated_startDate",
              "updated_endDate",
            ],
          });

          // Add tender dates to the clash data
          clashData.tender_dates = tenderDetails.map(tender => ({
            tender_id: tender.Tender_ID,
            original_start_date: tender.Start_Date,
            original_end_date: tender.Completion_Date,
            updated_start_date: tender.updated_startDate,
            updated_end_date: tender.updatedEndDate
          }));
        }

        return clashData;
      })
    );

    res.status(200).json({ clashes: enhancedClashes });
  } catch (error) {
    console.error("❌ Error fetching clashes by deptId:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch clashes", error: error.message });
  }
};

const getClashIdByDeptId = async (req, res) => {
  try {
    // Extract deptId from JWT token
    const { deptId } = req.user; // Extracted from JWT middleware

    // Log the extracted deptId

    if (!deptId) {
      console.error("❌ Unauthorized: No department assigned in token");
      return res
        .status(403)
        .json({ message: "Unauthorized: No department assigned" });
    }

    const { sequelize } = req.app.locals;
    const { Clashes } = sequelize.models;

    // Fetch clashes where the department is involved
    const clashes = await Clashes.findAll({
      where: sequelize.literal(
        `JSON_KEYS(involved_departments) LIKE '%"${deptId}"%'`
      ),
      attributes: [
        "clashID",
        "locality",
        "involved_departments",
        "involved_tenders",
        "start_dates",
        "end_dates",
        "is_resolved",
      ],
    });

    // Fallback: Filter results in JavaScript if JSON_CONTAINS fails
    if (clashes.length === 0) {
      console.warn(
        `⚠️ No clashes found using JSON_CONTAINS. Attempting fallback filtering for deptId: ${deptId}`
      );

      const allClashes = await Clashes.findAll({
        attributes: [
          "clashID",
          "involved_departments",
          "start_dates",
          "end_dates",
          "is_resolved",
        ],
      });

      const filteredClashes = allClashes.filter((clash) => {
        const involvedDepartments = clash.involved_departments;
        return involvedDepartments && involvedDepartments[deptId] !== undefined;
      });

      if (filteredClashes.length === 0) {
        console.warn(
          `⚠️ No clashes found for deptId: ${deptId} even after fallback filtering`
        );
        return res
          .status(404)
          .json({ message: "No clashes found for the given department ID" });
      }

      console.log(
        `✅ Fallback filtering result for deptId ${deptId}:`,
        filteredClashes
      );
      return res.status(200).json({ success: true, clashes: filteredClashes });
    }

    res.status(200).json({ success: true, clashes });
  } catch (error) {
    console.error("❌ Error fetching clash IDs by deptId:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch clash IDs", error: error.message });
  }
};

module.exports = {
  checkClashesNew,
  checkClashesNewHandler,
  storeClashesInDB,
  getInvolvedDeptStatus,
  updateInvolvedDeptStatus,
  getClashesByDeptId,
  getClashIdByDeptId,
};
