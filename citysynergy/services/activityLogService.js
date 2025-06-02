// Activity logging service

const createActivityLog = async (sequelize, data) => {
    try {
        const { ActivityLog } = sequelize.models;
        
        const log = await ActivityLog.create({
            activityType: data.activityType,
            description: data.description,
            userId: data.userId || null,
            deptId: data.deptId || null,
            metadata: data.metadata || null,
            ipAddress: data.ipAddress || null
        });
        
        return log;
    } catch (error) {
        console.error('Error creating activity log:', error);
        // Don't throw - logging should never break the main flow
        return null;
    }
};

const getRecentActivity = async (sequelize, limit = 10) => {
    try {
        const { ActivityLog, CommonUsers, CommonDepts } = sequelize.models;
        
        const logs = await ActivityLog.findAll({
            include: [
                {
                    model: CommonUsers,
                    attributes: ['uuid', 'username', 'email'],
                    required: false
                },
                {
                    model: CommonDepts,
                    attributes: ['deptId', 'deptName', 'deptCode'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit
        });
        
        return logs.map(log => ({
            id: log.logId,
            type: log.activityType,
            description: log.description,
            user: log.CommonUser ? {
                id: log.CommonUser.uuid,
                username: log.CommonUser.username,
                email: log.CommonUser.email
            } : null,
            department: log.CommonDept ? {
                id: log.CommonDept.deptId,
                name: log.CommonDept.deptName,
                code: log.CommonDept.deptCode
            } : null,
            metadata: log.metadata,
            timestamp: log.createdAt
        }));
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        throw error;
    }
};

const getSystemActivity = async (sequelize, days = 30) => {
    try {
        const { ActivityLog } = sequelize.models;
        const { Op } = require('sequelize');
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        // Get daily activity counts with more detailed metrics
        const dailyActivity = await ActivityLog.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('logId')), 'totalCount'],
                [
                    sequelize.literal(`COUNT(CASE WHEN activityType = 'LOGIN' THEN 1 END)`),
                    'loginCount'
                ],
                [
                    sequelize.literal(`COUNT(CASE WHEN activityType = 'USER_CREATED' OR activityType = 'USER_UPDATED' THEN 1 END)`),
                    'userActivityCount'
                ],
                [
                    sequelize.literal(`COUNT(CASE WHEN activityType = 'DEPT_CREATED' OR activityType = 'DEPT_UPDATED' THEN 1 END)`),
                    'deptActivityCount'
                ],
                [
                    sequelize.literal(`COUNT(CASE WHEN activityType = 'SYSTEM' THEN 1 END)`),
                    'systemCount'
                ]
            ],
            where: {
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
            order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
        });
        
        // Get activity type distribution
        const activityTypes = await ActivityLog.findAll({
            attributes: [
                'activityType',
                [sequelize.fn('COUNT', sequelize.col('logId')), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            group: ['activityType']
        });

        // Get hourly distribution for the selected period
        const hourlyDistribution = await ActivityLog.findAll({
            attributes: [
                [sequelize.fn('HOUR', sequelize.col('createdAt')), 'hour'],
                [sequelize.fn('COUNT', sequelize.col('logId')), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: startDate
                }
            },
            group: [sequelize.fn('HOUR', sequelize.col('createdAt'))],
            order: [[sequelize.fn('HOUR', sequelize.col('createdAt')), 'ASC']]
        });
        
        return {
            dailyActivity: dailyActivity.map(item => ({
                date: item.getDataValue('date'),
                total: parseInt(item.getDataValue('totalCount')),
                logins: parseInt(item.getDataValue('loginCount')),
                userActivity: parseInt(item.getDataValue('userActivityCount')),
                deptActivity: parseInt(item.getDataValue('deptActivityCount')),
                system: parseInt(item.getDataValue('systemCount'))
            })),
            activityTypes: activityTypes.map(item => ({
                type: item.activityType,
                count: parseInt(item.getDataValue('count'))
            })),
            hourlyDistribution: hourlyDistribution.map(item => ({
                hour: parseInt(item.getDataValue('hour')),
                count: parseInt(item.getDataValue('count'))
            }))
        };
    } catch (error) {
        console.error('Error fetching system activity:', error);
        throw error;
    }
};

module.exports = {
    createActivityLog,
    getRecentActivity,
    getSystemActivity
}; 