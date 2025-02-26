// User controller

const { withTransaction } = require('../utils/transactionManager');
const emailService = require('../services/emailService');
const bcrypt = require('bcrypt');
const { generateCustomId, generateTempPassword, getDepartmentModels } = require('../utils/helpers');
const { Op } = require('sequelize');

// Helper function to format user data
const formatUserData = (user, department = null) => ({
    id: user.uuid,
    username: user.username,
    email: user.email,
    type: user.type,
    deptId: user.deptId,
    department: department ? {
        id: department.deptId,
        name: department.deptName,
        code: department.deptCode
    } : null,
    state: {
        isFirstLogin: user.isFirstLogin,
        needsPasswordChange: user.needsPasswordChange,
        lastLogin: user.lastLogin
    }
});

const createUser = async (req, res) => {
    try {
        // Destructure username, email, type, deptId, and roles from the request body
        const { username, email, type = 'dept', deptId, roles } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, DevUserRole, DevRoles } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Validate department if deptId is provided
            let department;
            if (deptId) {
                department = await CommonDepts.findOne({
                    where: { deptId, isDeleted: false }
                });
                if (!department) {
                    throw new Error('Department not found or inactive');
                }
            }

            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Create user
            const user = await CommonUsers.create({
                username,  // Use the username from the request body
                password: hashedPassword,
                email,
                type,
                deptId: deptId || null,
                isFirstLogin: true,
                needsPasswordChange: true
            }, { transaction });

            // Handle role assignments
            if (roles?.length > 0) {
                if (type === 'dev') {
                    // Validate dev roles exist
                    const validRoles = await DevRoles.findAll({
                        where: {
                            roleId: { [Op.in]: roles },
                            isDeleted: false
                        }
                    });

                    if (validRoles.length !== roles.length) {
                        throw new Error('One or more invalid roles specified');
                    }

                    // Assign dev roles
                    await Promise.all(roles.map(roleId =>
                        DevUserRole.create({
                            userId: user.uuid,
                            roleId
                        }, { transaction })
                    ));
                } else if (deptId) {
                    const { DeptUserRole, DeptRole } = getDepartmentModels(deptId, department.deptCode);
                    
                    // Validate department roles exist
                    const validRoles = await DeptRole.findAll({
                        where: {
                            roleId: { [Op.in]: roles },
                            isDeleted: false
                        }
                    });

                    if (validRoles.length !== roles.length) {
                        throw new Error('One or more invalid department roles specified');
                    }

                    // Assign department roles
                    await Promise.all(roles.map(roleId =>
                        DeptUserRole.create({
                            userId: user.uuid,
                            roleId
                        }, { transaction })
                    ));
                }
            }

            return { user, tempPassword, department };
        });

        // Send email notifications
        if (result.user.type === 'dev') {
            await emailService.sendDevUserEmail(result.user, result.tempPassword);
        } else if (result.user.type === 'dept' && result.department) {
            await emailService.sendDepartmentUserEmail(
                result.user,
                result.tempPassword,
                result.department
            );
        }

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: formatUserData(result.user, result.department)
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
};

const listUsers = async (req, res) => {
    try {
        const { type, deptId } = req.query;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const whereClause = {
            isDeleted: false
        };

        if (type) whereClause.type = type;
        if (deptId) whereClause.deptId = deptId;

        const users = await CommonUsers.findAll({
            where: whereClause,
            attributes: ['uuid', 'username', 'email', 'type', 'deptId', 'lastLogin'],
            include: [{
                model: CommonDepts,
                attributes: ['deptName', 'deptCode'],
                required: false
            }]
        });

        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing users',
            error: error.message
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { email, roles } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            const user = await CommonUsers.findByPk(uuid);
            if (!user) throw new Error('User not found');

            // Update basic info
            if (email) {
                await user.update({ email, username: email }, { transaction });
            }

            // Update roles if provided
            if (roles?.length > 0) {
                if (user.type === 'dev') {
                    await updateDevRoles(user.uuid, roles, transaction);
                } else if (user.deptId) {
                    const department = await CommonDepts.findByPk(user.deptId);
                    await updateDepartmentRoles(user.uuid, roles, user.deptId, department.deptCode, transaction);
                }
            }

            return user;
        });

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: {
                uuid: result.uuid,
                email: result.email,
                type: result.type,
                deptId: result.deptId
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { CommonUsers } = req.app.locals.sequelize.models;
        const user = await CommonUsers.findByPk(uuid);
        
        if (!user) throw new Error('User not found');
        
        await user.update({ isDeleted: true });

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const { type, deptId } = req.query;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const whereClause = { isDeleted: false };
        if (type) whereClause.type = type;
        if (deptId) whereClause.deptId = deptId;

        const users = await CommonUsers.findAll({
            where: whereClause,
            include: [{
                model: CommonDepts,
                attributes: ['deptId', 'deptName', 'deptCode'],
                required: false
            }],
            attributes: [
                'uuid', 'username', 'email', 'type', 'deptId',
                'isFirstLogin', 'needsPasswordChange', 'lastLogin'
            ]
        });

        res.status(200).json({
            success: true,
            data: users.map(user => formatUserData(user, user.CommonDept))
        });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting users',
            error: error.message
        });
    }
};

const getUser = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { uuid, isDeleted: false },
            include: [{
                model: CommonDepts,
                attributes: ['deptId', 'deptName', 'deptCode']
            }],
            attributes: [
                'uuid', 'username', 'email', 'type', 'deptId',
                'isFirstLogin', 'needsPasswordChange', 'lastLogin'
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: formatUserData(user, user.CommonDept)
        });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting user',
            error: error.message
        });
    }
};

module.exports = {
    createUser,
    listUsers,
    updateUser,
    deleteUser,
    getUsers,
    getUser
};
