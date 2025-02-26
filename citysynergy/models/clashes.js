// Clashes model definition

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Clashes = sequelize.define('clashes', {
        clashId: {
            type: DataTypes.STRING,
            primaryKey: true,
            defaultValue: 'CLS001'
        },
        involvedDepartments: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {}  // Will be populated with {deptId: false} for each dept
        },
        proposedStartDates: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {}  // Will be populated with {deptId: startDate}
        },
        proposedEndDates: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {}  // Will be populated with {deptId: endDate}
        },
        proposedPlan: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {}  // Will be populated with {deptId: priorityNumber}
        },
        isResolved: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'clashes',
        timestamps: true,
        hooks: {
            beforeCreate: async (clash) => {
                if (!clash.clashId) {
                    clash.clashId = await generateCustomId(Clashes, 'CLS', 'clashId');
                }
            }
        }
    });

    return Clashes;
};
