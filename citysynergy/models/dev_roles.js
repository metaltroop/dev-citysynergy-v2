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
        hierarchyLevel: {
            type: DataTypes.INTEGER,
            allowNull: true, // Make it nullable for backward compatibility
            defaultValue: 100, // Default level, higher number means lower privilege
            comment: 'Role hierarchy level (lower number = higher privilege)'
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
                
                // Set default hierarchy level based on role name if not provided
                if (role.hierarchyLevel === null || role.hierarchyLevel === undefined) {
                    if (role.roleName.toLowerCase().includes('admin')) {
                        role.hierarchyLevel = 10;
                    } else if (role.roleName.toLowerCase().includes('owner')) {
                        role.hierarchyLevel = 20;
                    } else if (role.roleName.toLowerCase().includes('creator')) {
                        role.hierarchyLevel = 30;
                    } else if (role.roleName.toLowerCase().includes('manager')) {
                        role.hierarchyLevel = 40;
                    } else if (role.roleName.toLowerCase().includes('supervisor')) {
                        role.hierarchyLevel = 50;
                    } else if (role.roleName.toLowerCase().includes('user')) {
                        role.hierarchyLevel = 90;
                    } else {
                        role.hierarchyLevel = 100;
                    }
                }
            }
        }
    });

    return DevRoles;
};
