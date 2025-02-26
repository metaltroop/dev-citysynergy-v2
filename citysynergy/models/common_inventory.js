// Inventory model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const CommonInventory = sequelize.define('common_inventory', {
        itemId: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        deptId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        itemName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        itemCategory: {
            type: DataTypes.STRING,
            allowNull: true
        },
        itemDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        totalItems: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        availableItems: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        isSharable: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        lastUpdatedBy: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_users',
                key: 'uuid'
            }
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'common_inventory',
        timestamps: true,
        hooks: {
            beforeCreate: async (item) => {
                if (!item.itemId) {
                    item.itemId = await generateCustomId(CommonInventory, 'ITM', 'itemId');
                }
            }
        }
    });

    return CommonInventory;
};
