const { DataTypes } = require('sequelize');

module.exports = (prefix) => (sequelize) => {
    const DeptRoleFeature = sequelize.define(`${prefix}_roleFeature`, {
        roleId: {
            type: DataTypes.STRING,
            primaryKey: true,
            references: {
                model: `${prefix}_role`,
                key: 'roleId'
            }
        },
        featureId: {
            type: DataTypes.STRING,
            primaryKey: true,
            references: {
                model: `${prefix}_feature`,
                key: 'featureId'
            }
        },
        canRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        canWrite: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        canUpdate: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        canDelete: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: `${prefix}_roleFeature`,
        timestamps: true
    });

    return DeptRoleFeature;
};
