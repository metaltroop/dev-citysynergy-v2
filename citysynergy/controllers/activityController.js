const activityLogService = require('../services/activityLogService');

const getRecentActivity = async (req, res) => {
    try {
        const { limit } = req.query;
        const { sequelize } = req.app.locals;
        
        const activities = await activityLogService.getRecentActivity(
            sequelize, 
            limit ? parseInt(limit) : 10
        );
        
        res.status(200).json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recent activity',
            error: error.message
        });
    }
};

const getSystemActivity = async (req, res) => {
    try {
        const { days } = req.query;
        const { sequelize } = req.app.locals;
        
        const activity = await activityLogService.getSystemActivity(
            sequelize, 
            days ? parseInt(days) : 30
        );
        
        res.status(200).json({
            success: true,
            data: activity
        });
    } catch (error) {
        console.error('Error fetching system activity:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching system activity',
            error: error.message
        });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, Clash } = sequelize.models;
        
        // Get total users count
        const userCount = await CommonUsers.count({
            where: { isDeleted: false }
        });
        
        // Get departments count
        const deptCount = await CommonDepts.count({
            where: { isDeleted: false }
        });
        
        // Get active clashes
        const clashCount = await Clash.count({
            where: { isResolved: false }
        });
        
        // Calculate system health (this is a placeholder - implement your own logic)
        const systemHealth = 95.4; // Example value
        
        res.status(200).json({
            success: true,
            data: {
                userCount,
                deptCount,
                clashCount,
                systemHealth
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats',
            error: error.message
        });
    }
};

/**
 * Get all dashboard data in a single API call
 * Combines dashboard stats, recent activity, and system activity
 */
const getDevDashboard = async (req, res) => {
    try {
        const { limit = 10, days = 30 } = req.query;
        const { sequelize } = req.app.locals;
        
        // Verify models exist
        if (!sequelize || !sequelize.models) {
            throw new Error('Database connection not initialized');
        }
        
        const { CommonUsers, CommonDepts } = sequelize.models;
        
        // Verify required models exist
        if (!CommonUsers || !CommonDepts) {
            throw new Error('Required models not found');
        }

        // Run all queries in parallel for better performance
        const [recentActivities, systemActivity, stats] = await Promise.all([
            // Get recent activities
            activityLogService.getRecentActivity(sequelize, parseInt(limit)),
            
            // Get system activity
            activityLogService.getSystemActivity(sequelize, parseInt(days)),
            
            // Get dashboard stats
            (async () => {
                try {
                    // Get counts with error handling
                    const [userCount, deptCount, clashCount] = await Promise.all([
                        CommonUsers.count({ where: { isDeleted: false } }).catch(() => 0),
                        CommonDepts.count({ where: { isDeleted: false } }).catch(() => 0),
                       
                    ]);

                    // Calculate system health (this is a placeholder - implement your own logic)
                    const systemHealth = 95.4;

                    return {
                        userCount,
                        deptCount,
                        
                        systemHealth
                    };
                } catch (error) {
                    console.error('Error getting stats:', error);
                    return {
                        userCount: 0,
                        deptCount: 0,
                        
                        systemHealth: 0,
                        error: 'Error fetching statistics'
                    };
                }
            })()
        ]);
        
        // Return combined data
        res.status(200).json({
            success: true,
            data: {
                stats,
                recentActivities,
                systemActivity
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching dashboard data',
            error: error.toString()
        });
    }
};

module.exports = {
    getRecentActivity,
    getSystemActivity,
    getDashboardStats,
    getDevDashboard
};