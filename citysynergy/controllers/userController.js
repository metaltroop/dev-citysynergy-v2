// User controller

const { withTransaction } = require('../utils/transactionManager');
const emailService = require('../services/emailService');
const bcrypt = require('bcrypt');
const { generateCustomId, generateTempPassword, getDepartmentModels } = require('../utils/helpers');
const { Op } = require('sequelize');

const createUser = async (req, res) => {
    try {
        const { email, type = 'dept', deptId, roles } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Validate department if deptId is provided
            let department;
            if (deptId) {
                department = await CommonDepts.findByPk(deptId);
                if (!department) {
                    throw new Error('Department not found');
                }
            }

            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Create user with email as username
            const user = await CommonUsers.create({
                username: email, // Using email as username
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
                    await assignDevRoles(user.uuid, roles, transaction);
                } else if (deptId) {
                    await assignDepartmentRoles(user.uuid, roles, deptId, department.deptCode, transaction);
                }
            }

            return { user, tempPassword, department };
        });

        // Handle email notifications based on type and deptId
        if (result.user.type === 'dev') {
            await emailService.sendDevUserEmail(result.user, result.tempPassword);
        } else if (result.user.type === 'dept' && result.user.deptId) {
            await emailService.sendDepartmentUserEmail(
                result.user,
                result.tempPassword,
                result.department
            );
        }
        // No email for dept users without deptId (future department heads)

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                uuid: result.user.uuid,
                email: result.user.email,
                type: result.user.type,
                deptId: result.user.deptId
            }
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
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const users = await CommonUsers.findAll({
            where: { isDeleted: false },
            include: [{
                model: CommonDepts,
                attributes: ['deptId', 'deptName', 'deptCode']
            }],
            attributes: ['uuid', 'username', 'email', 'type', 'deptId']
        });

        res.status(200).json({
            success: true,
            data: users
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
            attributes: ['uuid', 'username', 'email', 'type', 'deptId']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
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
