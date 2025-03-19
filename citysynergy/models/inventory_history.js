// Inventory history model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const InventoryHistory = sequelize.define('inventory_history', {
        historyId: {
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
        action: {
            type: DataTypes.ENUM('created', 'updated', 'shared', 'requested', 'approved', 'rejected', 'returned', 'received_return', 'deleted'),
            allowNull: false
        },
        previousValue: {
            type: DataTypes.JSON,
            allowNull: true
        },
        newValue: {
            type: DataTypes.JSON,
            allowNull: false
        },
        performedBy: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_users',
                key: 'uuid'
            }
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'inventory_history',
        timestamps: true,
        hooks: {
            beforeCreate: async (history) => {
                if (!history.historyId) {
                    history.historyId = await generateCustomId(InventoryHistory, 'HIS', 'historyId');
                }
            }
        }
    });

    InventoryHistory.associate = (models) => {
        InventoryHistory.belongsTo(models.CommonInventory, {
            foreignKey: 'itemId',
            targetKey: 'itemId'
        });
        InventoryHistory.belongsTo(models.CommonUsers, {
            foreignKey: 'performedBy',
            targetKey: 'uuid',
            as: 'performer'
        });
    };

    return InventoryHistory;
}; 