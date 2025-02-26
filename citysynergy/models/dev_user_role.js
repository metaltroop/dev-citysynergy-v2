// User-Role mapping model

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DevUserRole = sequelize.define('DevUserRole', {
        userId: {
            type: DataTypes.STRING,
            primaryKey: true,
            references: {
                model: 'common_users',
                key: 'uuid'
            }
        },
        roleId: {
            type: DataTypes.STRING,
            primaryKey: true,
            references: {
                model: 'dev_roles',
                key: 'roleId'
            }
        }
    }, {
        tableName: 'dev_user_role',
        timestamps: true
    });

    return DevUserRole;
};
