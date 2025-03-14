const { withTransaction } = require('../utils/transactionManager');
const { getDepartmentModels, generateCustomId } = require('../utils/helpers');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const activityLogService = require('../services/activityLogService');

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

                // Validate roles exist
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

                // Remove existing roles
                await DevUserRole.destroy({
                    where: { userId },
                    transaction
                });

                // Assign new roles
                await DevUserRole.bulkCreate(
                    uniqueRoles.map(roleId => ({
                        userId,
                        roleId,
                        createdBy: req.user.uuid
                    })),
                    { transaction }
                );

                // Get role details for email notification
                const roleDetails = validRoles.map(role => ({
                    roleName: role.roleName,
                    roleId: role.roleId
                }));

                return { user, roleDetails };

            } else if (user.deptId) {
                const department = await CommonDept.findOne({
                    where: { 
                        deptId: user.deptId,
                        isDeleted: false 
                    },
                    transaction
                });

                if (!department) {
                    throw new Error('Department not found or inactive');
                }

                const deptModels = getDepartmentModels(user.deptId, department.deptCode);

                // Validate roles exist in department
                const validRoles = await deptModels.DeptRole.findAll({
                    where: { 
                        roleId: uniqueRoles,
                        isDeleted: false 
                    },
                    transaction
                });

                if (validRoles.length !== uniqueRoles.length) {
                    throw new Error('One or more invalid department role IDs');
                }

                // Remove existing roles
                await deptModels.DeptUserRole.destroy({
                    where: { userId },
                    transaction
                });

                // Assign new roles
                await deptModels.DeptUserRole.bulkCreate(
                    uniqueRoles.map(roleId => ({
                        userId,
                        roleId,
                        createdBy: req.user.uuid
                    })),
                    { transaction }
                );

                // Get role details for email notification
                const roleDetails = validRoles.map(role => ({
                    roleName: role.roleName,
                    roleId: role.roleId
                }));

                return { user, roleDetails, department };
            } else {
                throw new Error('User has no department assignment');
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
        res.status(error.message.includes('invalid') ? 400 : 500).json({
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
                    attributes: ['roleId', 'roleName']
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
                    roleName: r.role.roleName
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

        const result = await withTransaction(async (transaction) => {
            // Verify role exists
            const role = await DevRoles.findOne({
                where: { roleId, isDeleted: false },
                transaction
            });

            if (!role) {
                throw new Error('Role not found');
            }

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
                description: `Role "${role.roleName}" permissions updated`,
                userId: req.user?.uuid,
                metadata: {
                    roleId: role.roleId,
                    updatedPermissions: permissions
                },
                ipAddress: req.ip
            });

            return role;
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

        const result = await withTransaction(async (transaction) => {
            // Find role and check if exists
            const role = await DevRoles.findOne({
                where: { roleId, isDeleted: false },
                transaction
            });

            if (!role) {
                throw new Error('Role not found or already deleted');
            }

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
                roleId: result.role.roleId
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
        const { roleName, roleDescription } = req.body;
        const { sequelize } = req.app.locals;
        const { DevRoles, DevFeatures, DevRoleFeature } = sequelize.models;

        if (!roleName) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required'
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

            // Create new role
            const role = await DevRoles.create({
                roleId,
                roleName,
                roleDescription: roleDescription || null,
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
            description: `New role "${result.roleName}" created`,
            userId: req.user.uuid,
            metadata: {
                roleId: result.roleId
            },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: {
                roleId: result.roleId,
                roleName: result.roleName,
                roleDescription: result.roleDescription
            }
        });

    } catch (error) {
        console.error('Error creating role:', error);
        res.status(error.message.includes('already exists') ? 409 : 500).json({
            success: false,
            message: 'Error creating role',
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
    createDevRole
};