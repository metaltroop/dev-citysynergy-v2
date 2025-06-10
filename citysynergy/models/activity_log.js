const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const ActivityLog = sequelize.define('ActivityLog', {
        logId: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        activityType: {
            type: DataTypes.ENUM('USER_CREATED', 'USER_UPDATED', 'DEPT_CREATED', 'DEPT_UPDATED', 
        'ROLE_MODIFIED', 'CH_UPD', 'CLASH_DETECTED', 'CLASH_RESOLVED', 'LOGIN', 'LOGOUT', 'SYSTEM'
),
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'common_users',
                key: 'uuid'
            }
        },
        deptId: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
        },
        ipAddress: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'activity_logs',
        timestamps: true,
        hooks: {
            beforeCreate: async (log) => {
                if (!log.logId) {
                    log.logId = await generateCustomId(sequelize.models.ActivityLog, 'LOG', 'logId');
                }
            }
        }
    });

    return ActivityLog;
}; 