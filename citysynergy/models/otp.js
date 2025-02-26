const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const OTP = sequelize.define('otp', {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_users',
                key: 'uuid'
            }
        },
        otp: {
            type: DataTypes.STRING,
            allowNull: false
        },
        purpose: {
            type: DataTypes.ENUM('FIRST_LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'),
            allowNull: false
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        isUsed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'otp',
        timestamps: true,
        hooks: {
            beforeCreate: async (otp) => {
                if (!otp.id) {
                    otp.id = await generateCustomId(OTP, 'OTP', 'id');
                }
            }
        }
    });

    return OTP;
};