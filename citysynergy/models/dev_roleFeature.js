// Role-Feature mapping model

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DevRoleFeature = sequelize.define('DevRoleFeature', {
        roleId: {
            type: DataTypes.STRING,
            primaryKey: true,
            references: {
                model: 'dev_roles',
                key: 'roleId'
            }
        },
        featureId: {
            type: DataTypes.STRING,
            primaryKey: true,
            references: {
                model: 'dev_features',
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
        tableName: 'dev_role_feature',
        timestamps: true
    });

    return DevRoleFeature;
};
