const { DataTypes } = require('sequelize');

module.exports = (prefix) => (sequelize) => {
    const DeptUserRole = sequelize.define(`${prefix}_user_role`, {
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
                model: `${prefix}_role`,
                key: 'roleId'
            }
        }
    }, {
        tableName: `${prefix}_user_role`,
        timestamps: true
    });

    return DeptUserRole;
}; 