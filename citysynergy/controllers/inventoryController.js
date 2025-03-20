const { Op } = require('sequelize');
const { withTransaction } = require('../utils/invtransactionManager');
const emailService = require('../services/emailService');

// Resource Management Controllers

const createResource = async (req, res) => {
    try {
        const { itemName, itemCategory, itemDescription, totalItems, isSharable } = req.body;
        const deptId = req.user.deptId;
        const { sequelize } = req.app.locals;
        const { CommonInventory, InventoryHistory } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            const item = await CommonInventory.create({
                deptId,
                itemName,
                itemCategory,
                itemDescription,
                totalItems,
                availableItems: totalItems,
                sharedItems: 0,
                isSharable,
                isBorrowed: false,
                borrowedFromDeptId: null,
                borrowedQuantity: 0,
                lastUpdatedBy: req.user.uuid
            }, { transaction });

            // Record in history
            await InventoryHistory.create({
                itemId: item.itemId,
                action: 'created',
                newValue: item.toJSON(),
                performedBy: req.user.uuid
            }, { transaction });

            return { item };
        }, sequelize);

        res.status(201).json({
            success: true,
            data: result.item
        });
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const listDepartmentResources = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonInventory, CommonDepts } = sequelize.models;

        const items = await CommonInventory.findAll({
            where: {
                deptId: req.user.deptId,
                isDeleted: false
            },
            include: [
                {
                    model: CommonDepts,
                    as: 'department',
                    attributes: ['deptName']
                },
                {
                    model: CommonDepts,
                    as: 'borrowedFromDepartment',
                    attributes: ['deptName'],
                    required: false
                }
            ]
        });
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error listing department resources:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getInventoryHistory = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { sequelize } = req.app.locals;
        const { InventoryHistory, CommonUsers } = sequelize.models;

        // Build the where clause
        const whereClause = {
            itemId: {
                [Op.in]: sequelize.literal(`(SELECT itemId FROM common_inventory WHERE deptId = '${req.user.deptId}')`)
            }
        };

        // Add date range filter if provided
        if (startDate && endDate) {
            whereClause.createdAt = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        } else if (startDate) {
            whereClause.createdAt = {
                [Op.gte]: new Date(startDate)
            };
        } else if (endDate) {
            whereClause.createdAt = {
                [Op.lte]: new Date(endDate)
            };
        }

        const history = await InventoryHistory.findAll({
            where: whereClause,
            include: [{
                model: CommonUsers,
                as: 'performer',
                attributes: ['username']
            }],
            order: [['createdAt', 'DESC']]
        });
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error getting inventory history:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getSharableResources = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonInventory, CommonDepts } = sequelize.models;

        const items = await CommonInventory.findAll({
            attributes: [
                'itemId', 
                'deptId', 
                'itemName', 
                'itemCategory', 
                'itemDescription', 
                'sharedItems', 
                'isSharable', 
                'isBorrowed',
                'createdAt', 
                'updatedAt'
            ],
            where: {
                isSharable: true,
                sharedItems: {
                    [Op.gt]: 0
                },
                isBorrowed: false,
                deptId: {
                    [Op.ne]: req.user.deptId
                },
                isDeleted: false
            },
            include: [{
                model: CommonDepts,
                as: 'department',
                attributes: ['deptName', 'deptCode']
            }]
        });
        
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error getting sharable resources:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Sharing Management Controllers

const markItemAsShareable = async (req, res) => {
    try {
        const { itemId } = req.params;
        const quantity = parseInt(req.body.quantity, 10);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive number'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonInventory, InventoryHistory, CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            const item = await CommonInventory.findOne({
                where: {
                    itemId,
                    deptId: req.user.deptId,
                    isSharable: true,
                    isDeleted: false
                },
                include: [{
                    model: CommonDepts,
                    as: 'department',
                    attributes: ['deptName', 'deptCode']
                }],
                transaction
            });

            if (!item) {
                throw new Error('Item not found or not shareable');
            }

            if (quantity > item.availableItems) {
                throw new Error('Cannot share more items than available');
            }

            const previousValue = item.toJSON();
            // Now we're using a properly parsed number
            item.availableItems -= quantity;
            item.sharedItems += quantity;
            await item.save({ transaction });

            // Record in history
            await InventoryHistory.create({
                itemId,
                action: 'shared',
                previousValue,
                newValue: item.toJSON(),
                performedBy: req.user.uuid
            }, { transaction });

            return { item };
        }, sequelize);

       


        res.json({
            success: true,
            data: result.item
        });
    } catch (error) {
        console.error('Error marking item as shareable:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Request System Controllers

const createResourceRequest = async (req, res) => {
    try {
        const { itemId, fromDept, quantity } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonInventory, InventoryRequest, InventoryHistory, CommonDepts, CommonUsers } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            const item = await CommonInventory.findOne({
                where: {
                    itemId,
                    deptId: fromDept,
                    isSharable: true,
                    isDeleted: false
                },
                include: [{
                    model: CommonDepts,
                    as: 'department',
                    attributes: ['deptName', 'deptCode']
                }],
                transaction
            });

            if (!item) {
                throw new Error('Item not found or not shareable');
            }

            if (quantity > item.sharedItems) {
                throw new Error('Requested quantity exceeds available shared items');
            }

            const request = await InventoryRequest.create({
                itemId,
                fromDept,
                forDept: req.user.deptId,
                quantity,
                requestStatus: 'pending'
            }, { transaction });

            // Record in history
            await InventoryHistory.create({
                itemId,
                action: 'requested',
                newValue: {
                    ...request.toJSON(),
                    itemName: item.itemName,
                    fromDeptName: item.department.deptName
                },
                performedBy: req.user.uuid
            }, { transaction });

            return { request, item };
        }, sequelize);

        // Notify resource manager of the source department
        try {
            const sourceDept = await CommonDepts.findOne({
                where: { deptId: fromDept }
            });
            
            if (sourceDept) {
                const resourceManagers = await getResourceManagers(fromDept, sourceDept.deptCode, sequelize);
                
                if (resourceManagers && resourceManagers.length > 0) {
                    // Get requesting department name
                    const requestingDept = await CommonDepts.findOne({
                        where: { deptId: req.user.deptId }
                    });
                    
                    for (const manager of resourceManagers) {
                        try {
                            await emailService.sendInventoryRequestNotification(
                                manager,
                                result.item.itemName,
                                quantity,
                                'pending',
                                requestingDept.deptName
                            );
                        } catch (emailErr) {
                            console.error(`Failed to send email to ${manager.email}:`, emailErr);
                        }
                    }
                } else {
                    console.log(`No resource managers found for department ${sourceDept.deptName} (${fromDept})`);
                }
            }
        } catch (error) {
            console.error('Failed to notify resource manager:', error);
            // Continue with the request creation
        }

        res.status(201).json({
            success: true,
            data: result.request
        });
    } catch (error) {
        console.error('Error creating resource request:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getResourceRequests = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { InventoryRequest, CommonInventory, CommonDepts } = sequelize.models;

        const requests = await InventoryRequest.findAll({
            where: {
                [Op.or]: [
                    { fromDept: req.user.deptId },
                    { forDept: req.user.deptId }
                ],
                isDeleted: false
            },
            include: [
                {
                    model: CommonInventory,
                    attributes: ['itemName', 'itemCategory', 'itemDescription']
                },
                {
                    model: CommonDepts,
                    as: 'fromDepartment',
                    attributes: ['deptName', 'deptCode']
                },
                {
                    model: CommonDepts,
                    as: 'forDepartment',
                    attributes: ['deptName', 'deptCode']
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('Error getting resource requests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;
        const { sequelize } = req.app.locals;
        const { InventoryRequest, CommonInventory, InventoryHistory, CommonDepts, CommonUsers } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            const request = await InventoryRequest.findOne({
                where: {
                    requestId,
                    fromDept: req.user.deptId,
                    isDeleted: false
                },
                include: [
                    {
                        model: CommonDepts,
                        as: 'forDepartment',
                        attributes: ['deptName', 'deptCode']
                    }
                ],
                transaction
            });

            if (!request) {
                throw new Error('Request not found or unauthorized');
            }

            if (request.requestStatus !== 'pending') {
                throw new Error('Request has already been processed');
            }

            const item = await CommonInventory.findOne({
                where: {
                    itemId: request.itemId,
                    deptId: request.fromDept
                },
                transaction
            });

            if (status === 'approved') {
                if (request.quantity > item.sharedItems) {
                    throw new Error('Insufficient shared items');
                }

                const previousValue = item.toJSON();
                
                // When approving a request, decrement sharedItems
                item.sharedItems -= request.quantity;
                await item.save({ transaction });

                // Create inventory entry for requesting department
                await CommonInventory.create({
                    deptId: request.forDept,
                    itemName: item.itemName,
                    itemCategory: item.itemCategory,
                    itemDescription: item.itemDescription,
                    totalItems: request.quantity,
                    availableItems: request.quantity,
                    sharedItems: 0,
                    isSharable: 0,
                    isBorrowed: true,
                    borrowedFromDeptId: request.fromDept,
                    borrowedQuantity: request.quantity,
                    lastUpdatedBy: req.user.uuid
                }, { transaction });
            }

            request.requestStatus = status;
            await request.save({ transaction });

            // Record in history
            await InventoryHistory.create({
                itemId: request.itemId,
                action: status === 'approved' ? 'approved' : 'rejected',
                previousValue: request.toJSON(),
                newValue: { ...request.toJSON(), requestStatus: status },
                performedBy: req.user.uuid
            }, { transaction });

            return { request, item };
        }, sequelize);

        // Notify resource manager of the requesting department
        try {
            const targetDept = await CommonDepts.findOne({
                where: { deptId: result.request.forDept }
            });
            
            if (targetDept) {
                const resourceManagers = await getResourceManagers(result.request.forDept, targetDept.deptCode, sequelize);
                
                if (resourceManagers && resourceManagers.length > 0) {
                    // Get source department name
                    const sourceDept = await CommonDepts.findOne({
                        where: { deptId: result.request.fromDept }
                    });

                    for (const manager of resourceManagers) {
                       
                        try {
                            await emailService.sendInventoryRequestNotification(
                                manager,
                                result.item.itemName,
                                result.request.quantity,
                                status,
                                sourceDept.deptName
                            );
                           
                        } catch (emailErr) {
                            console.error(`Failed to send email to ${manager.email}:`, emailErr);
                        }
                    }
                } else {
                    console.log(`No resource managers found for department ${targetDept.deptName} (${result.request.forDept})`);
                }
            }
        } catch (error) {
            console.error('Failed to notify resource manager:', error);
            // Continue with the request update
        }

        res.json({
            success: true,
            data: result.request
        });
    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Return/Transfer System Controllers

const returnBorrowedItems = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonInventory, InventoryHistory, CommonDepts } = sequelize.models;

        if (!quantity || isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid return quantity is required'
            });
        }

        const result = await withTransaction(async (transaction) => {
            // Find the borrowed item in current department
            const borrowedItem = await CommonInventory.findOne({
                where: {
                    itemId,
                    deptId: req.user.deptId,
                    isBorrowed: true,
                    isDeleted: false
                },
                include: [{
                    model: CommonDepts,
                    as: 'borrowedFromDepartment',
                    attributes: ['deptName', 'deptCode']
                }],
                transaction
            });

            if (!borrowedItem) {
                throw new Error('Borrowed item not found or not eligible for return');
            }

            if (quantity > borrowedItem.borrowedQuantity) {
                throw new Error(`Cannot return more than borrowed quantity (${borrowedItem.borrowedQuantity})`);
            }

            const sourceDeptId = borrowedItem.borrowedFromDeptId;
            const returnQuantity = parseInt(quantity, 10);
            
            // Find the original item in source department
            const sourceItem = await CommonInventory.findOne({
                where: {
                    deptId: sourceDeptId,
                    itemName: borrowedItem.itemName,
                    isDeleted: false
                },
                transaction
            });

            if (!sourceItem) {
                throw new Error('Source item not found in original department');
            }

            // Save previous values for history
            const sourceItemPreviousValue = sourceItem.toJSON();
            const borrowedItemValue = borrowedItem.toJSON();

            // Handle the borrowed item first
            if (returnQuantity === borrowedItem.borrowedQuantity) {
                // Full return - mark the borrowed item as deleted
                borrowedItem.isDeleted = true;
            } else {
                // Partial return - update quantities
                borrowedItem.borrowedQuantity -= returnQuantity;
                borrowedItem.totalItems -= returnQuantity;
                borrowedItem.availableItems -= returnQuantity;
            }
            await borrowedItem.save({ transaction });

            // Direct database update for source item to bypass hooks
            await sequelize.query(
                `UPDATE common_inventory 
                 SET sharedItems = sharedItems + :returnQuantity 
                 WHERE itemId = :sourceItemId`,
                {
                    replacements: { 
                        returnQuantity,
                        sourceItemId: sourceItem.itemId 
                    },
                    transaction
                }
            );

            // Refresh the source item data
            await sourceItem.reload({ transaction });

            // Skip history creation for now
            /* 
            // Record history for borrowed item
            await InventoryHistory.create({
                itemId: borrowedItem.itemId,
                action: 'returned',
                previousValue: borrowedItemValue,
                newValue: {
                    ...borrowedItem.toJSON(),
                    returnedToDeptId: sourceDeptId,
                    returnedQuantity: returnQuantity
                },
                performedBy: req.user.uuid
            }, { transaction });

            // Record history for source item
            await InventoryHistory.create({
                itemId: sourceItem.itemId,
                action: 'updated',
                previousValue: sourceItemPreviousValue,
                newValue: sourceItem.toJSON(),
                performedBy: req.user.uuid
            }, { transaction });
            */

            return { 
                borrowedItem, 
                sourceItem, 
                returnQuantity, 
                isFullReturn: returnQuantity === borrowedItemValue.borrowedQuantity 
            };
        }, sequelize);

        // Notify resource manager of the source department
        try {
            if (result.borrowedItem.borrowedFromDepartment) {
                const sourceDept = result.borrowedItem.borrowedFromDepartment;
                const resourceManagers = await getResourceManagers(
                    result.borrowedItem.borrowedFromDeptId, 
                    sourceDept.deptCode, 
                    sequelize
                );
                
                if (resourceManagers && resourceManagers.length > 0) {
                    // Get returning department name
                    const returningDept = await CommonDepts.findOne({
                        where: { deptId: req.user.deptId }
                    });
                    
                    for (const manager of resourceManagers) {
                        try {
                            await emailService.sendInventoryReturnNotification(
                                manager,
                                result.borrowedItem.itemName,
                                result.returnQuantity,
                                returningDept.deptName
                            );
                        } catch (emailErr) {
                            console.error(`Failed to send email to ${manager.email}:`, emailErr);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to notify resource manager:', error);
            // Continue with the return process
        }

        res.json({
            success: true,
            message: result.isFullReturn ? 'Item fully returned' : 'Item partially returned',
            data: {
                returnedItem: result.borrowedItem.itemName,
                quantity: result.returnQuantity,
                returnedTo: result.borrowedItem.borrowedFromDepartment.deptName,
                remainingQuantity: result.isFullReturn ? 0 : result.borrowedItem.borrowedQuantity
            }
        });
    } catch (error) {
        console.error('Error returning borrowed items:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Search & Filtering Controller

const searchInventory = async (req, res) => {
    try {
        const { query, category, isSharable, isBorrowed } = req.query;
        const { sequelize } = req.app.locals;
        const { CommonInventory, CommonDepts } = sequelize.models;

        const where = {
            deptId: req.user.deptId,
            isDeleted: false
        };

        if (query) {
            where[Op.or] = [
                { itemName: { [Op.like]: `%${query}%` } },
                { itemDescription: { [Op.like]: `%${query}%` } }
            ];
        }

        if (category) {
            where.itemCategory = category;
        }

        if (isSharable !== undefined) {
            where.isSharable = isSharable === 'true';
        }
        
        if (isBorrowed !== undefined) {
            where.isBorrowed = isBorrowed === 'true';
        }

        const items = await CommonInventory.findAll({
            where,
            include: [
                {
                    model: CommonDepts,
                    as: 'department',
                    attributes: ['deptName']
                },
                {
                    model: CommonDepts,
                    as: 'borrowedFromDepartment',
                    attributes: ['deptName'],
                    required: false
                }
            ]
        });
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error searching inventory:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Borrowed Items
const getBorrowedItems = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonInventory, CommonDepts } = sequelize.models;

        const items = await CommonInventory.findAll({
            where: {
                deptId: req.user.deptId,
                isBorrowed: true,
                isDeleted: false
            },
            include: [{
                model: CommonDepts,
                as: 'borrowedFromDepartment',
                attributes: ['deptName', 'deptCode']
            }]
        });
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error getting borrowed items:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Items Borrowed By Other Departments
const getLentItems = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonInventory, CommonDepts } = sequelize.models;

        const items = await CommonInventory.findAll({
            where: {
                borrowedFromDeptId: req.user.deptId,
                isBorrowed: true,
                isDeleted: false
            },
            include: [{
                model: CommonDepts,
                as: 'department',
                attributes: ['deptName', 'deptCode']
            }]
        });
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error getting lent items:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Add this helper function at the top of the file
const getResourceManagers = async (deptId, deptCode, sequelize) => {
    try {
        if (!deptId || !deptCode) {
            console.log('Missing department information, cannot get resource managers');
            return [];
        }
        
        // Format properly with lowercase deptCode
        const userRoleTableName = `${deptId}_${deptCode.toLowerCase()}_user_role`;
        
        // Use backticks to escape table name
        const resourceManagers = await sequelize.query(`
            SELECT cu.uuid, cu.username, cu.email
            FROM \`${userRoleTableName}\` ur
            JOIN common_users cu ON ur.userId = cu.uuid
            WHERE ur.roleId = 'ROLE_RESOURCE_MANAGER'
            AND cu.isDeleted = false
        `, {
            type: sequelize.QueryTypes.SELECT
        });
        
        return resourceManagers;
    } catch (error) {
        console.error(`Error getting resource managers for dept ${deptId}_${deptCode}:`, error);
        return [];
    }
};

module.exports = {
    // Resource Management
    createResource,
    listDepartmentResources,
    getInventoryHistory,
    getSharableResources,

    // Sharing Management
    markItemAsShareable,

    // Request System
    createResourceRequest,
    getResourceRequests,
    updateRequestStatus,

    // Return/Transfer System
    returnBorrowedItems,

    // Search & Filtering
    searchInventory,
    
    // Additional Functionality
    getBorrowedItems,
    getLentItems
};