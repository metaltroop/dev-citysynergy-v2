// Role model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const DevRoles = sequelize.define('DevRoles', {
        roleId: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        roleName: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'dev_roles',
        timestamps: true,
        hooks: {
            beforeCreate: async (role) => {
                if (!role.roleId) {
                    role.roleId = await generateCustomId(sequelize.models.DevRoles, 'DROL', 'roleId');
                }
            }
        }
    });

    return DevRoles;
};
