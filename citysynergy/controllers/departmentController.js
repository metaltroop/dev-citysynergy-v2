// Department controller

const { createDepartmentModels, getDepartmentModels, initializeDepartmentTables } = require('../utils/dynamicModelGenerator');
const { withTransaction } = require('../utils/transactionManager');
const emailService = require('../services/emailService');
const bcrypt = require('bcrypt');
const { generateCustomId, generateTempPassword } = require('../utils/helpers');

const createDepartment = async (req, res) => {
    try {
        const { deptName, deptCode, headUserId } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Check if department code already exists
            const existingDept = await CommonDepts.findOne({
                where: { deptCode, isDeleted: false }
            });

            if (existingDept) {
                throw new Error('Department code already exists');
            }

            // Validate if the user exists and is not already assigned to a department
            const existingUser = await CommonUsers.findOne({
                where: {
                    uuid: headUserId,
                    type: 'dept',
                    deptId: null,
                    isDeleted: false
                }
            });

            if (!existingUser) {
                throw new Error('Invalid user selected for department head');
            }

            // Step 1: Create department
            const department = await CommonDepts.create({
                deptName,
                deptCode,
                deptHead: headUserId
            }, { transaction });

            // Step 2: Create department tables
            const deptModels = createDepartmentModels(sequelize, department.deptId, deptCode);
            await Promise.all([
                deptModels.DeptRole.sync({ transaction }),
                deptModels.DeptFeature.sync({ transaction }),
                deptModels.DeptRoleFeature.sync({ transaction }),
                deptModels.DeptUserRole.sync({ transaction })
            ]);

            // Step 3: Initialize department tables
            await initializeDepartmentTables(deptModels, transaction);

            // Step 4: Update user with department ID
            await existingUser.update({
                deptId: department.deptId
            }, { transaction });

            // Step 5: Assign department head role
            const deptHeadRole = await deptModels.DeptRole.findOne({
                where: { roleName: 'Department Head' },
                transaction
            });

            await deptModels.DeptUserRole.create({
                userId: existingUser.uuid,
                roleId: deptHeadRole.roleId
            }, { transaction });

            // Generate new temporary password for department head
            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Update user's password
            await existingUser.update({
                password: hashedPassword,
                needsPasswordChange: true,
                isFirstLogin: true
            }, { transaction });

            return {
                department,
                headUser: existingUser,
                tempPassword
            };
        });

        // Send email to department head with credentials and department info
        await emailService.sendDepartmentHeadCredentials(
            result.headUser,
            result.tempPassword,
            result.department
        );

        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            data: {
                department: {
                    deptId: result.department.deptId,
                    deptName: result.department.deptName,
                    deptCode: result.department.deptCode,
                    deptHead: result.department.deptHead
                },
                headUser: {
                    uuid: result.headUser.uuid,
                    email: result.headUser.email
                }
            }
        });

    } catch (error) {
        console.error('Error creating department:', error);
        
        // If tables were created, clean them up
        if (error.department?.deptId && error.department?.deptCode) {
            await cleanupDepartmentTables(error.department.deptId, error.department.deptCode);
        }

        res.status(500).json({
            success: false,
            message: 'Error creating department',
            error: error.message
        });
    }
};

// Helper function to clean up department tables in case of error
const cleanupDepartmentTables = async (departmentId, deptCode) => {
    try {
        const prefix = `${departmentId}_${deptCode}`;
        const tableNames = [
            `${prefix}_role`,
            `${prefix}_feature`,
            `${prefix}_roleFeature`,
            `${prefix}_user_role`
        ];

        for (const tableName of tableNames) {
            await sequelize.query(`DROP TABLE IF EXISTS ${tableName}`);
        }
    } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
    }
};

const createDepartmentRole = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { roleName } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDept } = sequelize.models;

        // Get department details
        const department = await CommonDept.findByPk(deptId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Get department models
        const deptModels = getDepartmentModels(deptId, department.deptCode);
        if (!deptModels) {
            return res.status(404).json({
                success: false,
                message: 'Department models not found'
            });
        }

        // Create new role
        const role = await deptModels.DeptRole.create({ roleName });

        res.status(201).json({
            success: true,
            message: 'Department role created successfully',
            data: role
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

const getDepartmentRoles = async (req, res) => {
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

        const deptModels = await getDepartmentModels(deptId, department.deptCode);
        const roles = await deptModels.DeptRole.findAll({
            where: { isDeleted: false },
            include: [{
                model: deptModels.DeptFeature,
                through: deptModels.DeptRoleFeature,
                attributes: ['featureId', 'featureName']
            }]
        });

        res.status(200).json({
            success: true,
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

const createDepartmentFeature = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { featureName, featureDescription } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDept } = sequelize.models;

        const department = await CommonDept.findByPk(deptId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        const deptModels = getDepartmentModels(deptId, department.deptCode);
        const feature = await deptModels.DeptFeature.create({
            featureName,
            featureDescription
        });

        res.status(201).json({
            success: true,
            message: 'Department feature created successfully',
            data: feature
        });
    } catch (error) {
        console.error('Error creating department feature:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating department feature',
            error: error.message
        });
    }
};

const getDepartmentFeatures = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonDept } = sequelize.models;

        const department = await CommonDept.findByPk(deptId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        const deptModels = getDepartmentModels(deptId, department.deptCode);
        const features = await deptModels.DeptFeature.findAll({
            where: { isDeleted: false }
        });

        res.status(200).json({
            success: true,
            data: features
        });
    } catch (error) {
        console.error('Error fetching department features:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching department features',
            error: error.message
        });
    }
};

const assignFeaturesToRole = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { roleId, features } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDept } = sequelize.models;

        const department = await CommonDept.findByPk(deptId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        const deptModels = getDepartmentModels(deptId, department.deptCode);
        
        // Create role-feature mappings
        const roleFeatures = features.map(feature => ({
            roleId,
            featureId: feature.featureId,
            canRead: feature.canRead || false,
            canWrite: feature.canWrite || false,
            canUpdate: feature.canUpdate || false,
            canDelete: feature.canDelete || false
        }));

        await deptModels.DeptRoleFeature.bulkCreate(roleFeatures, {
            updateOnDuplicate: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
        });

        res.status(200).json({
            success: true,
            message: 'Features assigned to role successfully'
        });
    } catch (error) {
        console.error('Error assigning features to role:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning features to role',
            error: error.message
        });
    }
};

const getDepartments = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers } = sequelize.models;

        const departments = await CommonDepts.findAll({
            where: { isDeleted: false },
            include: [{
                model: CommonUsers,
                as: 'head',
                attributes: ['uuid', 'username', 'email']
            }],
            attributes: ['deptId', 'deptName', 'deptCode', 'createdAt']
        });

        res.status(200).json({
            success: true,
            data: departments
        });
    } catch (error) {
        console.error('Error getting departments:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting departments',
            error: error.message
        });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { deptName, deptCode, headUserId } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            const department = await CommonDepts.findByPk(deptId, { transaction });
            if (!department) {
                throw new Error('Department not found');
            }

            await department.update({
                deptName,
                deptCode,
                deptHead: headUserId
            }, { transaction });

            return department;
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating department',
            error: error.message
        });
    }
};

module.exports = {
    createDepartment,
    getDepartments,
    updateDepartment,
    createDepartmentRole,
    getDepartmentRoles,
    assignFeaturesToRole,
    getDepartmentFeatures
};
