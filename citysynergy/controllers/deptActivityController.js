const { Op, fn, col, literal } = require('sequelize');

// Overview stats for department dashboard
const getDeptOverview = async (req, res) => {
    try {
        const { deptId } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers, AllTenders, Clashes, CommonInventory, CommonIssuees } = sequelize.models;

        if (!deptId) {
            return res
              .status(400)
              .json({ success: false, message: "Invalid token: deptId missing" });
          }

        // 1. Fetch department row
        const department = await CommonDepts.findOne({ where: { deptId, isDeleted: false } });
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        // 2. Build prefix (if needed for future use)
        const deptName = department.deptName;
        const deptCode = department.deptCode;
        const prefix = `${deptId}_${deptCode}`;

        // 3. Aggregate stats from global tables filtered by deptId
        const [
            totalUsers,
            totalTenders,
            activeTenders,
            totalClashes,
            totalInventory,
            unresolvedIssues
        ] = await Promise.all([
            CommonUsers.count({ where: { deptId, isDeleted: false } }),
            AllTenders.count({ where: { Tender_by_Department: deptName, } }),
            AllTenders.count({ where: { Tender_by_Department: deptName,  Complete_Pending: 'pending' } }),
            Clashes.count({ where: sequelize.literal(
                `JSON_KEYS(involved_departments) LIKE '%"${deptId}"%'`
              ) }),
            CommonInventory.count({ where: { deptId, isDeleted: false } }),
            CommonIssuees.count({ where: { deptId, "issueStatus.resolved": false } })
        ]);

        // 4. Respond with all stats
        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                totalTenders,
                activeTenders,
                totalClashes,
                totalInventory,
                unresolvedIssues
            }
        });
    } catch (error) {
        console.error('Error fetching department overview stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching department overview stats',
            error: error.message
        });
    }
};

// Tenders by Month (Bar Chart)
const getTendersByMonth = async (req, res) => {
    try {
        const { deptId } = req.user;
        const months = parseInt(req.query.months) || 4;
        const { sequelize } = req.app.locals;
        const { CommonDepts, AllTenders } = sequelize.models;

        const department = await CommonDepts.findOne({ where: { deptId, isDeleted: false } });
        if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

        const deptName = department.deptName;
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

        // Query tenders grouped by year and month
        const tenders = await AllTenders.findAll({
            attributes: [
                [fn('YEAR', col('createdAt')), 'year'],
                [fn('MONTH', col('createdAt')), 'month'],
                [fn('COUNT', col('Tender_id')), 'count']
            ],
            where: {
                Tender_by_Department: deptName,
                createdAt: { [Op.gte]: startDate }
            },
            group: [fn('YEAR', col('createdAt')), fn('MONTH', col('createdAt'))],
            order: [[fn('YEAR', col('createdAt')), 'ASC'], [fn('MONTH', col('createdAt')), 'ASC']]
        });

        // Build a map of month numbers to names
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Prepare a result object with all months in the range, defaulting to 0
        const result = {};
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
            const key = monthNames[d.getMonth()];
            result[key] = 0;
        }
        // Fill in the counts from the DB
        tenders.forEach(row => {
            const monthIdx = parseInt(row.get('month'), 10) - 1;
            const key = monthNames[monthIdx];
            if (key in result) {
                result[key] = parseInt(row.get('count'), 10);
            }
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching tenders by month', error: error.message });
    }
};

// Inventory Category Distribution (Pie Chart)
const getInventoryCategoryDistribution = async (req, res) => {
    try {
        const { deptId } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonInventory } = sequelize.models;

        const categories = await CommonInventory.findAll({
            attributes: ['itemCategory', [fn('COUNT', col('itemId')), 'count']],
            where: { deptId, isDeleted: false },
            group: ['itemCategory']
        });

        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching inventory category distribution', error: error.message });
    }
};

// Clash Resolution (Donut Chart)
const getClashResolution = async (req, res) => {
    try {
        const { deptId } = req.user;
        const { sequelize } = req.app.locals;
        const { Clashes } = sequelize.models;

        const allClashes = await Clashes.findAll({
            where: literal(`JSON_KEYS(involved_departments) LIKE '%"${deptId}"%'`)
        });

        const resolved = allClashes.filter(c => c.status === 'resolved').length;
        const unresolved = allClashes.length - resolved;
        const percentResolved = allClashes.length ? Math.round((resolved / allClashes.length) * 100) : 0;

        res.json({
            success: true,
            data: {
                resolved,
                unresolved,
                percentResolved
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching clash resolution', error: error.message });
    }
};

// Recent Activity
const getRecentActivity = async (req, res) => {
    try {
        const { deptId } = req.user;
        const limit = parseInt(req.query.limit) || 10;
        const { sequelize } = req.app.locals;
        const { ActivityLog } = sequelize.models;

        const logs = await ActivityLog.findAll({
            where: { deptId },
            order: [['createdAt', 'DESC']],
            limit
        });

        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching recent activity', error: error.message });
    }
};

module.exports = {
    getDeptOverview,
    getTendersByMonth,
    getInventoryCategoryDistribution,
    getClashResolution,
    getRecentActivity
};
