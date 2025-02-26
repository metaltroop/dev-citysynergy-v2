const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const CommonUsers = sequelize.define('CommonUsers', {
        uuid: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        type: {
            type: DataTypes.ENUM('dev', 'dept'),
            allowNull: false
        },
        deptId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isFirstLogin: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        needsPasswordChange: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        tempPassword: {
            type: DataTypes.STRING,
            allowNull: true
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'common_users',
        timestamps: true,
        hooks: {
            beforeCreate: async (user) => {
                if (!user.uuid) {
                    user.uuid = await generateCustomId(sequelize.models.CommonUsers, 'USR', 'uuid');
                }
            }
        }
    });

    return CommonUsers;
};