// Department model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const CommonDepts = sequelize.define('CommonDepts', {
        deptId: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        deptName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        deptCode: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        deptHead: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'common_dept',
        timestamps: true,
        hooks: {
            beforeCreate: async (dept) => {
                if (!dept.deptId) {
                    dept.deptId = await generateCustomId(sequelize.models.CommonDepts, 'DEPT', 'deptId');
                }
            }
        }
    });

    return CommonDepts;
};
