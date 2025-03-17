const { withTransaction } = require('../utils/transactionManager');
const { getDepartmentModels, generateCustomId } = require('../utils/helpers');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const activityLogService = require('../services/activityLogService');

// Helper function to get a user's minimum hierarchy level (highest privilege)
const getUserMinHierarchyLevel = async (userId, sequelize) => {
    const { DevUserRole, DevRoles } = sequelize.models;
    
    // Get all roles assigned to the user
    const userRoles = await DevUserRole.findAll({
        where: { userId },
        include: [{
            model: DevRoles,
            as: 'role',
            attributes: ['roleId', 'roleName', 'hierarchyLevel'],
            where: { isDeleted: false }
        }]
    });
    
    if (!userRoles || userRoles.length === 0) {
        return Number.MAX_SAFE_INTEGER; // No roles, lowest privilege
    }
    
    // Helper function to get default hierarchy level based on role name
    const getDefaultHierarchyLevel = (roleName) => {
        if (roleName.toLowerCase().includes('admin')) {
            return 10;
        } else if (roleName.toLowerCase().includes('owner')) {
            return 20;
        } else if (roleName.toLowerCase().includes('creator')) {
            return 30;
        } else if (roleName.toLowerCase().includes('manager')) {
            return 40;
        } else if (roleName.toLowerCase().includes('supervisor')) {
            return 50;
        } else if (roleName.toLowerCase().includes('user')) {
            return 90;
        }
        return 100;
    };
    
    // Find the minimum hierarchy level (highest privilege)
    // Handle null hierarchyLevel values by using default values based on role name
    const hierarchyLevels = userRoles.map(ur => {
        if (ur.role.hierarchyLevel === null || ur.role.hierarchyLevel === undefined) {
            return getDefaultHierarchyLevel(ur.role.roleName);
        }
        return ur.role.hierarchyLevel;
    });
    
    const minLevel = Math.min(...hierarchyLevels);
    return minLevel;
};

// Helper function to get a user's minimum hierarchy level in a department (highest privilege)
const getUserDeptMinHierarchyLevel = async (userId, deptId, deptCode, sequelize, transaction = null) => {
    try {
        const userRoleTableName = `${deptId}_${deptCode}_user_role`;
        const roleTableName = `${deptId}_${deptCode}_role`;
        
        // Get all roles assigned to the user in this department
        const userRoles = await sequelize.query(
            `SELECT r.roleId, r.roleName, r.hierarchyLevel
             FROM \`${userRoleTableName}\` ur
             JOIN \`${roleTableName}\` r ON ur.roleId = r.roleId
             WHERE ur.userId = :userId AND r.isDeleted = 0`,
            {
                replacements: { userId },
                type: sequelize.QueryTypes.SELECT,
                transaction
            }
        );
        
        if (!userRoles || userRoles.length === 0) {
            return Number.MAX_SAFE_INTEGER; // No roles, lowest privilege
        }
        
        // Helper function to get default hierarchy level based on role name
        const getDefaultHierarchyLevel = (roleName) => {
            if (roleName.toLowerCase().includes('head')) {
                return 10;
            } else if (roleName.toLowerCase().includes('admin')) {
                return 20;
            } else if (roleName.toLowerCase().includes('manager')) {
                return 50;
            } else if (roleName.toLowerCase().includes('supervisor')) {
                return 60;
            } else if (roleName.toLowerCase().includes('staff')) {
                return 100;
            }
            return 100;
        };
        
        // Find the minimum hierarchy level (highest privilege)
        // Handle null hierarchyLevel values by using default values based on role name
        const hierarchyLevels = userRoles.map(role => {
            if (role.hierarchyLevel === null || role.hierarchyLevel === undefined) {
                return getDefaultHierarchyLevel(role.roleName);
            }
            return role.hierarchyLevel;
        });
        
        const minLevel = Math.min(...hierarchyLevels);
        return minLevel;
    } catch (error) {
        console.error(`Error getting user department hierarchy level: ${error.message}`);
        return Number.MAX_SAFE_INTEGER; // Return lowest privilege on error
    }
};

const assignRoles = async (req, res) => {
    try {
        const { userId, roles } = req.body;
        const { sequelize } = req.app.locals;

        // Validate input
        if (!userId || !Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input: userId and roles array required'
            });
        }

        // Remove duplicate role IDs
        const uniqueRoles = [...new Set(roles)];

        // Get the user's minimum hierarchy level (highest privilege)
        const userHierarchyLevel = await getUserMinHierarchyLevel(req.user.uuid, sequelize);

        const result = await withTransaction(async (transaction) => {
            const { CommonUsers, CommonDept } = sequelize.models;

            // Get user with lock to prevent concurrent modifications
            const user = await CommonUsers.findOne({
                where: { uuid: userId, isDeleted: false },
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!user) {
                throw new Error('User not found or inactive');
            }

            if (user.type === 'dev') {
                const { DevRole, DevUserRole } = sequelize.models;

                // Validate roles exist and check hierarchy levels
                const validRoles = await DevRole.findAll({
                    where: { 
                        roleId: uniqueRoles,
                        isDeleted: false 
                    },
                    transaction
                });

                if (validRoles.length !== uniqueRoles.length) {
                    throw new Error('One or more invalid role IDs');
                }

                // Check if any role has a higher privilege than the current user
                const invalidRoles = validRoles.filter(role => role.hierarchyLevel <= userHierarchyLevel);
                if (invalidRoles.length > 0) {
                    throw new Error(`You cannot assign roles with equal or higher privilege than your own: ${invalidRoles.map(r => r.roleName).join(', ')}`);
                }

                // Delete existing roles
                await DevUserRole.destroy({
                    where: { userId },
                    transaction
                });

                // Add new roles
                await Promise.all(uniqueRoles.map(roleId => 
                    DevUserRole.create({
                        userId,
                        roleId
                    }, { transaction })
                ));

                // Get department for email notification
                let department = null;
                if (user.deptId) {
                    department = await CommonDept.findOne({
                        where: { deptId: user.deptId },
                        transaction
                    });
                }

                // Get role details for email notification
                const roleDetails = validRoles.map(role => ({
                    roleName: role.roleName,
                    roleId: role.roleId
                }));

                return { user, roleDetails, department };
            } else if (user.deptId) {
                // Handle department roles (unchanged)
                const department = await CommonDept.findOne({
                    where: { deptId: user.deptId },
                    transaction
                });

                if (department) {
                    const deptCode = department.deptCode.toLowerCase();
                    const deptTablePrefix = `${user.deptId}_${deptCode}`;

                    // Validate roles exist
                    const roleTableName = `${deptTablePrefix}_role`;
                    const roleResults = await sequelize.query(
                        `SELECT roleId, roleName FROM \`${roleTableName}\` 
                         WHERE roleId IN (:roles) AND isDeleted = 0`,
                        {
                            replacements: { roles: uniqueRoles },
                            type: sequelize.QueryTypes.SELECT,
                    transaction
                        }
                    );

                    if (roleResults.length !== uniqueRoles.length) {
                    throw new Error('One or more invalid department role IDs');
                }

                    // Delete existing roles
                    const userRoleTableName = `${deptTablePrefix}_user_role`;
                    await sequelize.query(
                        `DELETE FROM \`${userRoleTableName}\` WHERE userId = :userId`,
                        {
                            replacements: { userId },
                    transaction
                        }
                    );

                    // Add new roles
                    const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    await Promise.all(uniqueRoles.map(roleId => 
                        sequelize.query(
                            `INSERT INTO \`${userRoleTableName}\` (userId, roleId, createdAt, updatedAt) 
                             VALUES (:userId, :roleId, :createdAt, :updatedAt)`,
                            {
                                replacements: { 
                        userId,
                        roleId,
                                    createdAt: currentTimestamp, 
                                    updatedAt: currentTimestamp 
                                },
                                transaction
                            }
                        )
                    ));

                // Get role details for email notification
                    const roleDetails = roleResults.map(role => ({
                    roleName: role.roleName,
                    roleId: role.roleId
                }));

                return { user, roleDetails, department };
            } else {
                throw new Error('User has no department assignment');
                }
            }
        });

        // Send email notification
        if (result.department) {
            await emailService.sendRoleAssignmentEmail(result.user, result.roleDetails, result.department);
        } else {
            await emailService.sendRoleAssignmentEmail(result.user, result.roleDetails);
        }

        // Log role assignment
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'ROLE_MODIFIED',
            description: `Roles assigned to user ${result.user.email}`,
            userId: req.user.uuid,
            metadata: {
                targetUserId: userId,
                assignedRoles: uniqueRoles
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Roles assigned successfully',
            data: {
                userId: result.user.uuid,
                type: result.user.type,
                deptId: result.user.deptId,
                roles: result.roleDetails
            }
        });

    } catch (error) {
        console.error('Error assigning roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning roles',
            error: error.message
        });
    }
};

const getUserRoles = async (req, res) => {
    try {
        const { userId } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDept } = sequelize.models;

        const user = await CommonUsers.findByPk(userId);
        if (!user) throw new Error('User not found');

        let roles = [];

        if (user.type === 'dev') {
            const { DevRole, DevUserRole } = sequelize.models;
            roles = await DevUserRole.findAll({
                where: { userId },
                include: [{
                    model: DevRole,
                    attributes: ['roleId', 'roleName', 'hierarchyLevel']
                }]
            });
        } else if (user.deptId) {
            const department = await CommonDept.findByPk(user.deptId);
            if (department) {
                const deptModels = getDepartmentModels(user.deptId, department.deptCode);
                roles = await deptModels.DeptUserRole.findAll({
                    where: { userId },
                    include: [{
                        model: deptModels.DeptRole,
                        attributes: ['roleId', 'roleName']
                    }]
                });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                userId: user.uuid,
                type: user.type,
                deptId: user.deptId,
                roles: roles.map(r => ({
                    roleId: r.role.roleId,
                    roleName: r.role.roleName,
                    hierarchyLevel: r.role.hierarchyLevel
                }))
            }
        });

    } catch (error) {
        console.error('Error getting user roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting user roles',
            error: error.message
        });
    }
};

const getdevRoles = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { DevRoles, DevFeatures, DevRoleFeature } = sequelize.models;        
        
        const roles = await DevRoles.findAll({
            where: { isDeleted: false },
            attributes: ['roleId', 'roleName', 'hierarchyLevel'],
            include: [{
                model: DevFeatures,
                through: {
                    model: DevRoleFeature,
                    attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                },
                attributes: ['featureId', 'featureName']
            }]
        });

        const formattedRoles = roles.map(role => ({
            roleId: role.roleId,
            roleName: role.roleName,
            hierarchyLevel: role.hierarchyLevel,
            features: role.DevFeatures.map(feature => ({
                featureId: feature.featureId,
                featureName: feature.featureName,
                permissions: {
                    canRead: feature.DevRoleFeature.canRead,
                    canWrite: feature.DevRoleFeature.canWrite,
                    canUpdate: feature.DevRoleFeature.canUpdate,
                    canDelete: feature.DevRoleFeature.canDelete
                }
            }))
        }));

        res.status(200).json({
            success: true,
            data: formattedRoles
        });
    } catch (error) {
        console.error('Error getting roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting roles',
            error: error.message
        });
    }
};

const getDevRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { sequelize } = req.app.locals;
        const { DevRoles, DevFeatures, DevRoleFeature } = sequelize.models;

        const role = await DevRoles.findOne({
            where: { roleId, isDeleted: false },
            include: [{
                model: DevFeatures,
                through: {
                    model: DevRoleFeature,
                    attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                },
                attributes: ['featureId', 'featureName']
            }]
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        const permissions = role.DevFeatures.map(feature => ({
            featureId: feature.featureId,
            featureName: feature.featureName,
            permissions: {
                canRead: feature.DevRoleFeature.canRead,
                canWrite: feature.DevRoleFeature.canWrite,
                canUpdate: feature.DevRoleFeature.canUpdate,
                canDelete: feature.DevRoleFeature.canDelete
            }
        }));

        res.status(200).json({
            success: true,
            data: {
                roleId: role.roleId,
                roleName: role.roleName,
                hierarchyLevel: role.hierarchyLevel,
                features: permissions
            }
        });
    } catch (error) {
        console.error('Error getting role permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting role permissions',
            error: error.message
        });
    }
};

const updateDevRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissions } = req.body;
        const { sequelize } = req.app.locals;
        const { DevRoles, DevRoleFeature } = sequelize.models;

        // Get the role to be updated
        const targetRole = await DevRoles.findOne({
            where: { roleId, isDeleted: false }
        });

        if (!targetRole) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Get the user's minimum hierarchy level (highest privilege)
        const userHierarchyLevel = await getUserMinHierarchyLevel(req.user.uuid, sequelize);
        
        // Check if user has sufficient privileges to modify this role
        if (userHierarchyLevel >= targetRole.hierarchyLevel) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to modify this role. You can only modify roles with a lower privilege level than your own.'
            });
        }

        const result = await withTransaction(async (transaction) => {
            // Update permissions
            await Promise.all(permissions.map(async (perm) => {
                await DevRoleFeature.update(
                    {
                        canRead: perm.canRead,
                        canWrite: perm.canWrite,
                        canUpdate: perm.canUpdate,
                        canDelete: perm.canDelete
                    },
                    {
                        where: {
                            roleId: roleId,
                            featureId: perm.featureId
                        },
                        transaction
                    }
                );
            }));

            await activityLogService.createActivityLog(sequelize, {
                activityType: 'ROLE_MODIFIED',
                description: `Role "${targetRole.roleName}" permissions updated`,
                userId: req.user?.uuid,
                metadata: {
                    roleId: targetRole.roleId,
                    updatedPermissions: permissions
                },
                ipAddress: req.ip
            });

            return targetRole;
        });

        res.status(200).json({
            success: true,
            message: 'Permissions updated successfully',
            data: {
                roleId: result.roleId,
                roleName: result.roleName
            }
        });

    } catch (error) {
        console.error('Error updating role permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating role permissions',
            error: error.message
        });
    }
};

const getDeptRolesByDeptId = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const department = await CommonDepts.findByPk(deptId);
        if (!department) { 
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        //fetch role from {prefix} using sql query prefix conssit of deptId and deptCode
        const prefix = `${deptId}_${department.deptCode}`;
        const roles = await sequelize.query(
            `SELECT * FROM ${prefix}_role WHERE isDeleted = 0`,
            { type: sequelize.QueryTypes.SELECT }
        );

        res.status(200).json({
            success: true,
            message : 'Roles fetched successfully for ' + department.deptName,
            data: roles
        });
    } catch (error) {
        console.error('Error getting department roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting department roles',
            error: error.message
        });
    }
};

const deleteDevRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { sequelize } = req.app.locals;
        const { DevRoles, DevUserRole, CommonUsers } = sequelize.models;

            // Find role and check if exists
            const role = await DevRoles.findOne({
            where: { roleId, isDeleted: false }
            });

            if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found or already deleted'
            });
        }

        // Get the user's minimum hierarchy level (highest privilege)
        const userHierarchyLevel = await getUserMinHierarchyLevel(req.user.uuid, sequelize);
        
        // Check if user has sufficient privileges to delete this role
        if (userHierarchyLevel >= role.hierarchyLevel) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this role. You can only delete roles with a lower privilege level than your own.'
            });
        }

        const result = await withTransaction(async (transaction) => {
            // Find all users with this role
            const usersWithRole = await DevUserRole.findAll({
                where: { roleId },
                include: [{
                    model: CommonUsers,
                    as: 'CommonUser',  // Match the alias defined in association
                    attributes: ['uuid', 'email', 'username']
                }],
                transaction
            });

            // Process each user
            await Promise.all(usersWithRole.map(async (userRole) => {
                const user = userRole.CommonUser; // Changed from userRole.CommonUsers

                // Check if user has other roles
                const otherRoles = await DevUserRole.count({
                    where: {
                        userId: user.uuid,
                        roleId: { [Op.ne]: roleId }
                    },
                    transaction
                });

                // If no other roles, reset user's password and send notification
                if (otherRoles === 0) {
                    await CommonUsers.update({
                        password: null,
                        tempPassword: null,
                        needsPasswordChange: true
                    }, {
                        where: { uuid: user.uuid },
                        transaction
                    });

                    // Send email notification
                    await emailService.sendRoleRemovedNotice(user)
                        .catch(err => console.error(`Failed to send email to ${user.email}:`, err));
                }
            }));

            // Remove all role assignments
            await DevUserRole.destroy({
                where: { roleId },
                transaction
            });

            // Soft delete the role
            await role.update({ isDeleted: true }, { transaction });

            return {
                role,
                affectedUsers: usersWithRole.length
            };
        });

        // Log role deletion
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'ROLE_MODIFIED',
            description: `Role "${result.role.roleName}" deleted`,
            userId: req.user.uuid,
            metadata: {
                roleId: result.role.roleId,
                hierarchyLevel: result.role.hierarchyLevel
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Role deleted successfully',
            data: {
                roleId: result.role.roleId,
                roleName: result.role.roleName,
                usersAffected: result.affectedUsers
            }
        });

    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
};

const createDevRole = async (req, res) => {
    try {
        const { roleName, roleDescription, hierarchyLevel = 100 } = req.body;
        const { sequelize } = req.app.locals;
        const { DevRoles, DevFeatures, DevRoleFeature } = sequelize.models;

        if (!roleName) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required'
            });
        }

        // Get the user's minimum hierarchy level (highest privilege)
        const userHierarchyLevel = await getUserMinHierarchyLevel(req.user.uuid, sequelize);
        
        // Check if user has sufficient privileges to create a role at this level
        if (userHierarchyLevel >= hierarchyLevel) {
            return res.status(403).json({
                success: false,
                message: 'You cannot create a role with equal or higher privilege than your own. The hierarchyLevel must be higher than your current level.'
            });
        }

        const result = await withTransaction(async (transaction) => {
            // Check if role name already exists
            const existingRole = await DevRoles.findOne({
                where: { 
                    roleName,
                    isDeleted: false 
                },
                transaction
            });

            if (existingRole) {
                throw new Error('Role name already exists');
            }

            // Find highest existing roleId number including deleted roles
            const lastRole = await DevRoles.findOne({
                order: [['roleId', 'DESC']], // Order by roleId instead of createdAt
                paranoid: false, // Include soft-deleted records
                transaction
            });

            let nextNumber = 1;
            if (lastRole) {
                const lastNumber = parseInt(lastRole.roleId.slice(-3));
                nextNumber = lastNumber + 1;
            }

            const roleId = `DROL${String(nextNumber).padStart(3, '0')}`;

            // Create new role with hierarchy level
            const role = await DevRoles.create({
                roleId,
                roleName,
                roleDescription: roleDescription || null,
                hierarchyLevel: parseInt(hierarchyLevel),
                isDeleted: false
            }, { transaction });

            // Get all features
            const features = await DevFeatures.findAll({
                where: { isDeleted: false },
                transaction
            });

            // Create role-feature mappings with all permissions set to false
            const roleFeatures = features.map(feature => ({
                roleId: role.roleId,
                featureId: feature.featureId,
                canRead: false,
                canWrite: false,
                canUpdate: false,
                canDelete: false
            }));

            await DevRoleFeature.bulkCreate(roleFeatures, { transaction });

            return role;
        });

        // Log role creation
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'ROLE_MODIFIED',
            description: `New role "${result.roleName}" created with hierarchy level ${result.hierarchyLevel}`,
            userId: req.user.uuid,
            metadata: {
                roleId: result.roleId,
                hierarchyLevel: result.hierarchyLevel
            },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: {
                roleId: result.roleId,
                roleName: result.roleName,
                hierarchyLevel: result.hierarchyLevel
            }
        });

    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: error.message
        });
    }
};

// Create a new role in the department's dynamically created tables
const createDeptRole = async (req, res) => {
    try {
        const { roleName, roleDescription, hierarchyLevel = 100 } = req.body;
        const { deptId, uuid: creatorId } = req.user; // Get deptId and creator ID from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        if (!roleName) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Get department info to validate and for table names
            const department = await CommonDepts.findOne({
                where: { deptId, isDeleted: false },
                transaction
            });

            if (!department) {
                throw new Error('Department not found or inactive');
            }

            const deptCode = department.deptCode;
            
            // Get the user's minimum hierarchy level in this department (highest privilege)
            const userHierarchyLevel = await getUserDeptMinHierarchyLevel(
                creatorId, 
                deptId, 
                deptCode, 
                sequelize, 
                transaction
            );
            
            // Check if user has sufficient privileges to create a role at this level
            if (userHierarchyLevel >= hierarchyLevel) {
                throw new Error('You cannot create a role with equal or higher privilege than your own. The hierarchyLevel must be higher than your current level.');
            }
            
            const prefix = `${deptId}_${deptCode}`;
            
            // Check if role name already exists in the department
            const roleTableName = `${prefix}_role`;
            const [existingRole] = await sequelize.query(
                `SELECT roleId FROM \`${roleTableName}\` 
                 WHERE roleName = :roleName AND isDeleted = 0`,
                {
                    replacements: { roleName },
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (existingRole) {
                throw new Error('Role name already exists in this department');
            }

            // Find highest existing roleId number including deleted roles
            const [lastRole] = await sequelize.query(
                `SELECT roleId FROM \`${roleTableName}\` 
                 ORDER BY CAST(SUBSTRING(roleId, 5) AS UNSIGNED) DESC LIMIT 1`,
                {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            let nextNumber = 1;
            if (lastRole) {
                // Fix the parsing of the last number from the roleId
                const lastIdMatch = lastRole.roleId.match(/\d+$/);
                if (lastIdMatch) {
                    nextNumber = parseInt(lastIdMatch[0]) + 1;
                }
            }

            // Generate new role ID with department prefix
            const roleId = `${deptCode.toUpperCase()}${String(nextNumber).padStart(3, '0')}`;
            
            // Create new role in the department's role table with hierarchy level
            const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await sequelize.query(
                `INSERT INTO \`${roleTableName}\` 
                 (roleId, roleName, description, hierarchyLevel, isDeleted, createdAt, updatedAt) 
                 VALUES (:roleId, :roleName, :description, :hierarchyLevel, 0, :createdAt, :updatedAt)`,
                {
                    replacements: { 
                        roleId, 
                        roleName, 
                        description: roleDescription || null,
                        hierarchyLevel: parseInt(hierarchyLevel),
                        createdAt: currentTimestamp, 
                        updatedAt: currentTimestamp 
                    },
                    transaction,
                    type: sequelize.QueryTypes.INSERT
                }
            );

            // Get all features from the department's feature table
            const featureTableName = `${prefix}_feature`;
            const features = await sequelize.query(
                `SELECT featureId FROM \`${featureTableName}\` WHERE isDeleted = 0`,
                {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            // Create role-feature mappings with only read permission set to true
            const roleFeatureTableName = `${prefix}_role_feature`;
            
            for (const feature of features) {
                await sequelize.query(
                    `INSERT INTO \`${roleFeatureTableName}\` 
                     (roleId, featureId, canRead, canWrite, canUpdate, canDelete, createdAt, updatedAt) 
                     VALUES (:roleId, :featureId, 1, 0, 0, 0, :createdAt, :updatedAt)`,
                    {
                        replacements: { 
                            roleId, 
                            featureId: feature.featureId,
                            createdAt: currentTimestamp, 
                            updatedAt: currentTimestamp 
                        },
                        transaction,
                        type: sequelize.QueryTypes.INSERT
                    }
                );
            }

            // Log role creation
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'ROLE_MODIFIED',
                description: `New department role "${roleName}" created with hierarchy level ${hierarchyLevel}`,
                userId: creatorId,
                deptId: deptId,
                metadata: {
                    roleId,
                    roleName,
                    hierarchyLevel,
                    departmentId: deptId,
                    departmentCode: deptCode
                },
                ipAddress: req.ip
            }, transaction);

            return { 
                roleId, 
                roleName, 
                roleDescription,
                hierarchyLevel,
                department
            };
        });

        res.status(201).json({
            success: true,
            message: 'Department role created successfully',
            data: {
                roleId: result.roleId,
                roleName: result.roleName,
                roleDescription: result.roleDescription,
                hierarchyLevel: result.hierarchyLevel,
                department: {
                    deptId: result.department.deptId,
                    deptName: result.department.deptName,
                    deptCode: result.department.deptCode
                }
            }
        });

    } catch (error) {
        console.error('Error creating department role:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating department role',
            error: error.message
        });
    }
};

// Get roles for the logged-in user's department with hierarchy information
const getDeptRoles = async (req, res) => {
    try {
        const { deptId } = req.user; // Get deptId from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        // Get department info to validate and for table names
        const department = await CommonDepts.findOne({
            where: { deptId, isDeleted: false }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        const deptCode = department.deptCode;
        const prefix = `${deptId}_${deptCode}`;
        
        // Get roles from the department's role table with hierarchy information
        const roleTableName = `${prefix}_role`;
        const roles = await sequelize.query(
            `SELECT roleId, roleName, description, hierarchyLevel, createdAt, updatedAt 
             FROM \`${roleTableName}\` 
             WHERE isDeleted = 0 
             ORDER BY hierarchyLevel ASC`,
            { type: sequelize.QueryTypes.SELECT }
        );

        // Get feature permissions for each role
        const roleFeatureTableName = `${prefix}_role_feature`;
        const featureTableName = `${prefix}_feature`;
        
        const rolesWithPermissions = await Promise.all(roles.map(async (role) => {
            const permissions = await sequelize.query(
                `SELECT rf.featureId, f.featureName, rf.canRead, rf.canWrite, rf.canUpdate, rf.canDelete 
                 FROM \`${roleFeatureTableName}\` rf
                 JOIN \`${featureTableName}\` f ON rf.featureId = f.featureId
                 WHERE rf.roleId = :roleId AND f.isDeleted = 0`,
                {
                    replacements: { roleId: role.roleId },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            
            return {
                ...role,
                features: permissions.map(perm => ({
                    featureId: perm.featureId,
                    featureName: perm.featureName,
                    permissions: {
                        canRead: Boolean(perm.canRead),
                        canWrite: Boolean(perm.canWrite),
                        canUpdate: Boolean(perm.canUpdate),
                        canDelete: Boolean(perm.canDelete)
                    }
                }))
            };
        }));

        res.status(200).json({
            success: true,
            message: `Roles fetched successfully for ${department.deptName}`,
            data: {
                department: {
                    deptId: department.deptId,
                    deptName: department.deptName,
                    deptCode: department.deptCode
                },
                roles: rolesWithPermissions
            }
        });
    } catch (error) {
        console.error('Error getting department roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting department roles',
            error: error.message
        });
    }
};

//get role by id  for the logged in users department with hierarchy information with permissions and features form {prefix}_feature table and  permissions from {prefix}_role_feature table
const getDeptRoleById = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { deptId } = req.user; // Get deptId from the authenticated user's token

        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const department = await CommonDepts.findOne({
            where: { deptId, isDeleted: false }
        }); 

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        const deptCode = department.deptCode;
        const prefix = `${deptId}_${deptCode}`;

        const roleTableName = `${prefix}_role`;
        const role = await sequelize.query(
            `SELECT roleId, roleName, description, hierarchyLevel, createdAt, updatedAt 
             FROM \`${roleTableName}\` 
             WHERE roleId = :roleId AND isDeleted = 0`,
            {
                replacements: { roleId },
                type: sequelize.QueryTypes.SELECT   
            }
        );

        if (!role) {
            return res.status(404).json({
                success: false, 
                message: 'Role not found or inactive'
            });
        }

        const roleFeatureTableName = `${prefix}_role_feature`;
        const featureTableName = `${prefix}_feature`;

        const roleFeatures = await sequelize.query(
            `SELECT rf.featureId, f.featureName, rf.canRead, rf.canWrite, rf.canUpdate, rf.canDelete 
             FROM \`${roleFeatureTableName}\` rf    
             JOIN \`${featureTableName}\` f ON rf.featureId = f.featureId
             WHERE rf.roleId = :roleId AND f.isDeleted = 0`,
            {
                replacements: { roleId },
                type: sequelize.QueryTypes.SELECT
            }   
        );

        const roleWithPermissions = {
            ...role,
            features: roleFeatures.map(perm => ({
                featureId: perm.featureId,
                featureName: perm.featureName,
                permissions: {
                    canRead: Boolean(perm.canRead),
                    canWrite: Boolean(perm.canWrite),
                    canUpdate: Boolean(perm.canUpdate),
                    canDelete: Boolean(perm.canDelete)
                }
            }))
        };

        res.status(200).json({
            success: true,
            message: 'Role fetched successfully',
            data: roleWithPermissions
        });
    } catch (error) {
        console.error('Error getting department role by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting department role by ID',
            error: error.message
        });
    }
};  

// Update permissions for a department role
const updateDeptRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissions } = req.body;
        const { deptId, uuid: editorId } = req.user; // Get deptId and editor ID from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Permissions array is required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Get department info to validate and for table names
            const department = await CommonDepts.findOne({
                where: { deptId, isDeleted: false },
                transaction
            });

            if (!department) {
                throw new Error('Department not found or inactive');
            }

            const deptCode = department.deptCode;
            const prefix = `${deptId}_${deptCode}`;
            
            // Get the role to be updated
            const roleTableName = `${prefix}_role`;
            const [targetRole] = await sequelize.query(
                `SELECT roleId, roleName, hierarchyLevel 
                 FROM \`${roleTableName}\` 
                 WHERE roleId = :roleId AND isDeleted = 0`,
                {
                    replacements: { roleId },
                    type: sequelize.QueryTypes.SELECT,
                    transaction
                }
            );

            if (!targetRole) {
                throw new Error('Role not found or inactive');
            }
            
            // Get the user's minimum hierarchy level in this department (highest privilege)
            const userHierarchyLevel = await getUserDeptMinHierarchyLevel(
                editorId, 
                deptId, 
                deptCode, 
                sequelize, 
                transaction
            );
            
            // Check if user has sufficient privileges to modify this role
            if (userHierarchyLevel >= targetRole.hierarchyLevel) {
                throw new Error('You do not have permission to modify this role. You can only modify roles with a lower privilege level than your own.');
            }
            
            // Update permissions for each feature
            const roleFeatureTableName = `${prefix}_role_feature`;
            
            for (const perm of permissions) {
                if (!perm.featureId) {
                    continue; // Skip entries without featureId
                }
                
                // Ensure boolean values for permissions
                const canRead = perm.canRead ? 1 : 0;
                const canWrite = perm.canWrite ? 1 : 0;
                const canUpdate = perm.canUpdate ? 1 : 0;
                const canDelete = perm.canDelete ? 1 : 0;
                
                // Check if role-feature mapping exists
                const [existingMapping] = await sequelize.query(
                    `SELECT id FROM \`${roleFeatureTableName}\` 
                     WHERE roleId = :roleId AND featureId = :featureId`,
                    {
                        replacements: { 
                            roleId, 
                            featureId: perm.featureId 
                        },
                        type: sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                if (existingMapping) {
                    // Update existing mapping
                    await sequelize.query(
                        `UPDATE \`${roleFeatureTableName}\` 
                         SET canRead = :canRead, canWrite = :canWrite, 
                             canUpdate = :canUpdate, canDelete = :canDelete,
                             updatedAt = :updatedAt
                         WHERE roleId = :roleId AND featureId = :featureId`,
                        {
                            replacements: { 
                                roleId, 
                                featureId: perm.featureId,
                                canRead,
                                canWrite,
                                canUpdate,
                                canDelete,
                                updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
                            },
                            transaction
                        }
                    );
                } else {
                    // Create new mapping if it doesn't exist
                    const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    await sequelize.query(
                        `INSERT INTO \`${roleFeatureTableName}\` 
                         (roleId, featureId, canRead, canWrite, canUpdate, canDelete, createdAt, updatedAt) 
                         VALUES (:roleId, :featureId, :canRead, :canWrite, :canUpdate, :canDelete, :createdAt, :updatedAt)`,
                        {
                            replacements: { 
                                roleId, 
                                featureId: perm.featureId,
                                canRead,
                                canWrite,
                                canUpdate,
                                canDelete,
                                createdAt: currentTimestamp,
                                updatedAt: currentTimestamp
                            },
                            transaction
                        }
                    );
                }
            }
            
            // Log permission update
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'ROLE_MODIFIED',
                description: `Department role "${targetRole.roleName}" permissions updated`,
                userId: editorId,
                deptId: deptId,
                metadata: {
                    roleId: targetRole.roleId,
                    roleName: targetRole.roleName,
                    updatedPermissions: permissions.map(p => ({
                        featureId: p.featureId,
                        canRead: Boolean(p.canRead),
                        canWrite: Boolean(p.canWrite),
                        canUpdate: Boolean(p.canUpdate),
                        canDelete: Boolean(p.canDelete)
                    }))
                },
                ipAddress: req.ip
            }, transaction);
            
            return { 
                role: targetRole,
                department
            };
        });

        res.status(200).json({
            success: true,
            message: 'Role permissions updated successfully',
            data: {
                roleId: result.role.roleId,
                roleName: result.role.roleName,
                department: {
                    deptId: result.department.deptId,
                    deptName: result.department.deptName,
                    deptCode: result.department.deptCode
                }
            }
        });
    } catch (error) {
        console.error('Error updating department role permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating department role permissions',
            error: error.message
        });
    }
};

// Soft delete a department role by ID
const softDeleteDeptRoleById = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { deptId, uuid: deleterId } = req.user; // Get deptId and deleter ID from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Get department info to validate and for table names
            const department = await CommonDepts.findOne({
                where: { deptId, isDeleted: false },
                transaction
            });

            if (!department) {
                throw new Error('Department not found or inactive');
            }

            const deptCode = department.deptCode;
            const prefix = `${deptId}_${deptCode}`;
            
            // Get the role to be deleted
            const roleTableName = `${prefix}_role`;
            const [targetRole] = await sequelize.query(
                `SELECT roleId, roleName, hierarchyLevel 
                 FROM \`${roleTableName}\` 
                 WHERE roleId = :roleId AND isDeleted = 0`,
                {
                    replacements: { roleId },
                    type: sequelize.QueryTypes.SELECT,
                    transaction
                }
            );

            if (!targetRole) {
                throw new Error('Role not found or already deleted');
            }
            
            // Get the user's minimum hierarchy level in this department (highest privilege)
            const userHierarchyLevel = await getUserDeptMinHierarchyLevel(
                deleterId, 
                deptId, 
                deptCode, 
                sequelize, 
                transaction
            );
            
            // Check if user has sufficient privileges to delete this role
            if (userHierarchyLevel >= targetRole.hierarchyLevel) {
                throw new Error('You do not have permission to delete this role. You can only delete roles with a lower privilege level than your own.');
            }
            
            // Find the lowest hierarchy role (ROLE_STAFF or similar)
            const [lowestHierarchyRole] = await sequelize.query(
                `SELECT roleId, roleName, hierarchyLevel 
                 FROM \`${roleTableName}\` 
                 WHERE isDeleted = 0 AND roleId != :roleId
                 ORDER BY hierarchyLevel DESC 
                 LIMIT 1`,
                {
                    replacements: { roleId },
                    type: sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            if (!lowestHierarchyRole) {
                throw new Error('Cannot delete the only role in the department');
            }
            
            // Find all users with this role
            const userRoleTableName = `${prefix}_user_role`;
            const usersWithRole = await sequelize.query(
                `SELECT ur.userId, u.email, u.username
                 FROM \`${userRoleTableName}\` ur
                 JOIN common_users u ON ur.userId = u.uuid
                 WHERE ur.roleId = :roleId`,
                {
                    replacements: { roleId },
                    type: sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            // Process each user with this role
            const affectedUsers = [];
            for (const user of usersWithRole) {
                // Check if user has other roles in this department
                const [otherRoles] = await sequelize.query(
                    `SELECT COUNT(*) as count
                     FROM \`${userRoleTableName}\` 
                     WHERE userId = :userId AND roleId != :roleId`,
                    {
                        replacements: { 
                            userId: user.userId,
                            roleId
                        },
                        type: sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                // If user has no other roles, assign the lowest hierarchy role
                if (otherRoles.count === 0) {
                    // Check if user already has the lowest hierarchy role
                    const [hasLowestRole] = await sequelize.query(
                        `SELECT COUNT(*) as count
                         FROM \`${userRoleTableName}\` 
                         WHERE userId = :userId AND roleId = :lowestRoleId`,
                        {
                            replacements: { 
                                userId: user.userId,
                                lowestRoleId: lowestHierarchyRole.roleId
                            },
                            type: sequelize.QueryTypes.SELECT,
                            transaction
                        }
                    );
                    
                    if (hasLowestRole.count === 0) {
                        // Assign the lowest hierarchy role
                        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                        await sequelize.query(
                            `INSERT INTO \`${userRoleTableName}\` 
                             (userId, roleId, createdAt, updatedAt) 
                             VALUES (:userId, :roleId, :createdAt, :updatedAt)`,
                            {
                                replacements: { 
                                    userId: user.userId,
                                    roleId: lowestHierarchyRole.roleId,
                                    createdAt: currentTimestamp,
                                    updatedAt: currentTimestamp
                                },
                                transaction
                            }
                        );
                        
                        // Add user to affected users list for email notification
                        affectedUsers.push({
                            userId: user.userId,
                            email: user.email,
                            username: user.username,
                            newRoleId: lowestHierarchyRole.roleId,
                            newRoleName: lowestHierarchyRole.roleName
                        });
                    }
                }
            }
            
            // Remove all role assignments for the deleted role
            await sequelize.query(
                `DELETE FROM \`${userRoleTableName}\` WHERE roleId = :roleId`,
                {
                    replacements: { roleId },
                    transaction
                }
            );
            
            // Soft delete the role
            await sequelize.query(
                `UPDATE \`${roleTableName}\` 
                 SET isDeleted = 1, updatedAt = :updatedAt
                 WHERE roleId = :roleId`,
                {
                    replacements: { 
                        roleId,
                        updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
                    },
                    transaction
                }
            );
            
            // Log role deletion
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'ROLE_MODIFIED',
                description: `Department role "${targetRole.roleName}" deleted`,
                userId: deleterId,
                deptId: deptId,
                metadata: {
                    roleId: targetRole.roleId,
                    roleName: targetRole.roleName,
                    hierarchyLevel: targetRole.hierarchyLevel,
                    affectedUsers: affectedUsers.map(u => u.userId)
                },
                ipAddress: req.ip
            }, transaction);
            
            return { 
                role: targetRole,
                department,
                lowestHierarchyRole,
                affectedUsers
            };
        });
        
        // Send email notifications to affected users
        for (const user of result.affectedUsers) {
            await emailService.sendRoleChangedEmail(
                { uuid: user.userId, email: user.email, username: user.username },
                result.role.roleName,
                result.lowestHierarchyRole.roleName,
                result.department
            ).catch(err => console.error(`Failed to send email to ${user.email}:`, err));
        }

        res.status(200).json({
            success: true,
            message: 'Department role deleted successfully',
            data: {
                roleId: result.role.roleId,
                roleName: result.role.roleName,
                department: {
                    deptId: result.department.deptId,
                    deptName: result.department.deptName,
                    deptCode: result.department.deptCode
                },
                usersAffected: result.affectedUsers.length
            }
        });
    } catch (error) {
        console.error('Error deleting department role:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting department role',
            error: error.message
        });
    }
};

// Add to module.exports
module.exports = {
    assignRoles,
    getUserRoles,
    // getRoles,
    getdevRoles,
    getDeptRolesByDeptId,
    getDevRolePermissions,
    updateDevRolePermissions,
    deleteDevRole,
    createDevRole,
    createDeptRole,
    getDeptRoles,
    getDeptRoleById,
    updateDeptRolePermissions,
    softDeleteDeptRoleById
};