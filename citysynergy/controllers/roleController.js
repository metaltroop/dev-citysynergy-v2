const { withTransaction } = require('../utils/transactionManager');
const { getDepartmentModels } = require('../utils/helpers');
const emailService = require('../services/emailService');

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

const getRoles = async (req, res) => {
    try {
        const { type, deptId } = req.query;
        const { sequelize } = req.app.locals;
        const { DevRoles, CommonDepts } = sequelize.models;

        if (type === 'dev') {
            const roles = await DevRoles.findAll({
                where: { isDeleted: false }
            });
            return res.status(200).json({
                success: true,
                data: roles
            });
        } 
        
        if (deptId) {
            const department = await CommonDepts.findOne({
                where: { deptId, isDeleted: false }
            });

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            const deptModels = await getDepartmentModels(deptId, department.deptCode);
            const roles = await deptModels.DeptRole.findAll({
                where: { isDeleted: false }
            });

            return res.status(200).json({
                success: true,
                data: roles
            });
        }

        return res.status(400).json({
            success: false,
            message: 'Invalid query parameters'
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

module.exports = {
    assignRoles,
    getUserRoles,
    getRoles
}; 