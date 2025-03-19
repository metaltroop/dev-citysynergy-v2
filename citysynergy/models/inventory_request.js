// Inventory request model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const InventoryRequest = sequelize.define('inventory_request', {
        requestId: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        itemId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_inventory',
                key: 'itemId'
            }
        },
        fromDept: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        forDept: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1
            }
        },
        requestStatus: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'inventory_request',
        timestamps: true,
        hooks: {
            beforeCreate: async (request) => {
                if (!request.requestId) {
                    request.requestId = await generateCustomId(InventoryRequest, 'ITMRQ', 'requestId');
                }
            }
        }
    });

    return InventoryRequest;
};