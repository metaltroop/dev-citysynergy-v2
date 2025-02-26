const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../../utils/helpers');

module.exports = (prefix) => (sequelize) => {
    const DeptRole = sequelize.define(`${prefix}_role`, {
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
        tableName: `${prefix}_role`,
        timestamps: true,
        hooks: {
            beforeCreate: async (role) => {
                if (!role.roleId) {
                    role.roleId = await generateCustomId(DeptRole, `${prefix}ROL`, 'roleId');
                }
            }
        }
    });

    return DeptRole;
};
