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

module.exports = {
    getRecentActivity,
    getSystemActivity,
    getDashboardStats
}; 