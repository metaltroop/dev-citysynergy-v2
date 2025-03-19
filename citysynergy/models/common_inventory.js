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
            allowNull: false
        },
        itemDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        totalItems: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        availableItems: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        sharedItems: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        isSharable: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        isBorrowed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        borrowedFromDeptId: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        borrowedQuantity: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        lastUpdatedBy: {
            type: DataTypes.STRING,
            allowNull: true,
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
        tableName: 'common_inventory',
        timestamps: true,
        hooks: {
            beforeCreate: async (item) => {
                if (!item.itemId) {
                    item.itemId = await generateCustomId(CommonInventory, 'ITM', 'itemId');
                }
                // Ensure availableItems equals totalItems on creation
                if (item.totalItems && !item.availableItems) {
                    item.availableItems = item.totalItems;
                }
            },
            beforeUpdate: async (item) => {
                // BYPASS ALL VALIDATION FOR BORROWED ITEMS
                // This ensures return operations can work without constraints
                if (item.getDataValue('isBorrowed') === true) {
                    return;
                }
                
                // Ensure totalItems = availableItems + sharedItems
                if (item.changed('availableItems') || item.changed('sharedItems')) {
                    // Skip this check when approving inventory requests (where sharedItems decrease)
                    // This is a special case where items are transferred to another department
                    const oldSharedItems = item.previous('sharedItems');
                    const newSharedItems = item.getDataValue('sharedItems');
                    
                    // Skip validation if sharedItems are decreasing (transfer scenario)
                    if (oldSharedItems > newSharedItems) {
                        return;
                    }
                    
                    const calculatedTotal = (item.availableItems || item.getDataValue('availableItems')) + 
                                   (item.sharedItems || item.getDataValue('sharedItems'));
                    if (calculatedTotal !== item.totalItems) {
                        throw new Error('Total items must equal available items plus shared items');
                    }
                }
            }
        }
    });

    CommonInventory.associate = (models) => {
        CommonInventory.belongsTo(models.CommonDept, {
            foreignKey: 'deptId',
            as: 'department'
        });
        CommonInventory.belongsTo(models.CommonDept, {
            foreignKey: 'borrowedFromDeptId',
            as: 'borrowedFromDepartment'
        });
        CommonInventory.belongsTo(models.CommonUsers, {
            foreignKey: 'lastUpdatedBy',
            as: 'updatedByUser'
        });
    };

    return CommonInventory;
};