// File: controllers/activityController.js

const activityLogService = require('../services/activityLogService');
const { Op } = require('sequelize');

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
        const { days = 7 } = req.query;
        const { sequelize } = req.app.locals;
        
        // Validate days parameter
        const validDays = Math.min(Math.max(parseInt(days) || 30, 1), 90);
        
        const activity = await activityLogService.getSystemActivity(
            sequelize, 
            validDays
        );
        
        res.status(200).json({
            success: true,
            data: {
                ...activity,
                daysRequested: validDays,
                timeRange: {
                    start: new Date(Date.now() - (validDays * 24 * 60 * 60 * 1000)).toISOString(),
                    end: new Date().toISOString()
                }
            }
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

const calculateSystemHealth = async (sequelize) => {
    try {
        const { ActivityLog, Clashes, CommonUsers, CommonDepts } = sequelize.models;
        const metrics = {};
        
        // 1. Error Rate (last 24 hours)
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [totalActivities, errorActivities] = await Promise.all([
            ActivityLog.count({
                where: {
                    createdAt: { [Op.gte]: last24Hours }
                }
            }),
            ActivityLog.count({
                where: {
                    activityType: 'SYSTEM',
                    description: { [Op.like]: '%error%' },
                    createdAt: { [Op.gte]: last24Hours }
                }
            })
        ]);
        metrics.errorRate = totalActivities ? (1 - (errorActivities / totalActivities)) * 100 : 100;

        // 2. User Activity Health (active users vs total users)
        const [totalUsers, activeUsers] = await Promise.all([
            CommonUsers.count({ where: { isDeleted: false } }),
            ActivityLog.count({
                where: {
                    activityType: 'LOGIN',
                    createdAt: { [Op.gte]: last24Hours }
                },
                distinct: true,
                col: 'userId'
            })
        ]);
        metrics.userActivityHealth = totalUsers ? (activeUsers / totalUsers) * 100 : 100;

        // 3. Clash Resolution Rate
        const [totalClashes, resolvedClashes] = await Promise.all([
            Clashes.count(),
            Clashes.count({ where: { is_resolved: true } })
        ]);
        metrics.clashResolutionRate = totalClashes ? (resolvedClashes / totalClashes) * 100 : 100;

        // 4. Department Activity Health
        const totalDepts = await CommonDepts.count({ where: { isDeleted: false } });
        const activeDepts = await ActivityLog.count({
            where: {
                createdAt: { [Op.gte]: last24Hours }
            },
            distinct: true,
            col: 'deptId'
        });
        metrics.deptActivityHealth = totalDepts ? (activeDepts / totalDepts) * 100 : 100;

        // Calculate overall system health (weighted average)
        const weights = {
            errorRate: 0.7,           // 10% weight to error rate
            userActivityHealth: 0.1,   // 40% weight to user activity
            clashResolutionRate: 0.1,  // 20% weight to clash resolution
            deptActivityHealth: 0.1    // 30% weight to department activity
        };

        const systemHealth = Object.keys(metrics).reduce((acc, key) => {
            return acc + (metrics[key] * weights[key]);
        }, 0);

        return parseFloat(systemHealth.toFixed(1));
    } catch (error) {
        console.error('Error calculating system health:', error);
        return 95.4; // Fallback to default value if calculation fails
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, Clashes } = sequelize.models;
        
        // Get total users count
        const userCount = await CommonUsers.count({
            where: { isDeleted: false }
        });
        
        // Get departments count
        const deptCount = await CommonDepts.count({
            where: { isDeleted: false }
        });
        
        // Get active clashes
        const clashCount = await Clashes.count({
            where: { isResolved: false }
        });
        
        // Calculate system health
        const systemHealth = await calculateSystemHealth(sequelize);
        
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
        const { limit = 10 } = req.query;
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
        const [recentActivities, stats] = await Promise.all([
            // Get recent activities
            activityLogService.getRecentActivity(sequelize, parseInt(limit)),
            
            // Get dashboard stats
            (async () => {
                try {
                    // Get counts with error handling
                    const [userCount, deptCount, clashCount] = await Promise.all([
                        CommonUsers.count({ where: { isDeleted: false } }).catch(() => 0),
                        CommonDepts.count({ where: { isDeleted: false } }).catch(() => 0),
                        sequelize.models.Clashes.count({ where: { is_resolved: false } }).catch(() => 0)
                    ]);

                    // Calculate system health
                    const systemHealth = await calculateSystemHealth(sequelize);

                    return {
                        userCount,
                        deptCount,
                        clashCount,
                        systemHealth
                    };
                } catch (error) {
                    console.error('Error getting stats:', error);
                    return {
                        userCount: 0,
                        deptCount: 0,
                        clashCount: 0,
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
                recentActivities
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