// Department controller

const { createDepartmentModels, getDepartmentModels, initializeDepartmentTables } = require('../utils/dynamicModelGenerator');
const { withTransaction } = require('../utils/transactionManager');
const emailService = require('../services/emailService');
const bcrypt = require('bcrypt');
const { generateCustomId, generateTempPassword } = require('../utils/helpers');
const activityLogService = require('../services/activityLogService');

const createDepartment = async (req, res) => {
    try {
        const { deptName, deptCode, headUserId } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers } = sequelize.models;

        if (!deptName || !deptCode || !headUserId) {
            return res.status(400).json({
                success: false,
                message: 'Department name, code and head user ID are required'
            });
        }

        // Check if department code exists (including soft-deleted departments)
        const existingDept = await CommonDepts.findOne({
            where: { deptCode },
            paranoid: false // This will include soft-deleted records
        });

        if (existingDept) {
            return res.status(409).json({
                success: false,
                message: 'Department code already exists',
                error: `The department code '${deptCode}' is already in use${existingDept.isDeleted ? ' (by a deleted department)' : ''}. Please use a different code.`
            });
        }

        const result = await withTransaction(async (transaction) => {
            // Check if department code already exists
            const existingDept = await CommonDepts.findOne({
                where: { deptCode, isDeleted: false },
                transaction
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
                },
                transaction
            });

            if (!existingUser) {
                throw new Error('Invalid user selected for department head');
            }

            // Generate temporary password BEFORE hashing
            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Update user with hashed temporary password
            await existingUser.update({
                tempPassword: hashedPassword,  // Store hashed version
                isFirstLogin: true, 
                needsPasswordChange: true
            }, { transaction });

            // Create department
            const department = await CommonDepts.create({
                deptName,
                deptCode,
                deptHead: headUserId
            }, { transaction });

            // Create department tables
            const deptModels = createDepartmentModels(sequelize, department.deptId, deptCode);
            await Promise.all([
                deptModels.DeptRole.sync({ transaction }),
                deptModels.DeptFeature.sync({ transaction }),
                deptModels.DeptRoleFeature.sync({ transaction }),
                deptModels.DeptUserRole.sync({ transaction })
            ]);

            // Initialize department tables
            await initializeDepartmentTables(deptModels, transaction);

            // Update user with department ID
            await existingUser.update({
                deptId: department.deptId
            }, { transaction });

            // Send email with original temporary password
            await emailService.sendDepartmentHeadCredentials(
                existingUser,
                tempPassword,  // Send original unhashed password
                department
            );

            // Assign department head role
            const deptHeadRole = await deptModels.DeptRole.findOne({
                where: { roleName: 'Department Head' },
                transaction
            });

            await deptModels.DeptUserRole.create({
                userId: existingUser.uuid,
                roleId: deptHeadRole.roleId
            }, { transaction });

            return { department, deptTables: [deptModels.DeptRole, deptModels.DeptFeature, deptModels.DeptRoleFeature, deptModels.DeptUserRole] };
        });

        // Log department creation
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'DEPT_CREATED',
            description: `Department "${result.department.deptName}" created`,
            userId: req.user.uuid,
            deptId: result.department.deptId,
            metadata: {
                deptCode: result.department.deptCode,
                headUserId: result.department.deptHead,
                tablesCreated: result.deptTables.map(t => t.tableName)
            },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            data: {
                deptId: result.department.deptId,
                deptName: result.department.deptName,
                deptCode: result.department.deptCode,
                deptHead: result.department.deptHead
            }
        });

    } catch (error) {
        console.error('Error creating department:', error);
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
                as: 'DeptHead',
                attributes: ['uuid', 'username', 'email'],
                required: false
            }],
            attributes: ['deptId', 'deptName', 'deptCode', 'createdAt']
        });

        // Get all users for each department in a separate query
        const formattedDepartments = await Promise.all(departments.map(async (dept) => {
            const users = await CommonUsers.findAll({
                where: { 
                    deptId: dept.deptId,
                    isDeleted: false 
                },
                attributes: ['uuid', 'username', 'email']
            });

            return {
                deptId: dept.deptId,
                deptName: dept.deptName,
                deptCode: dept.deptCode,
                createdAt: dept.createdAt,
                users: users,
                deptHead: dept.DeptHead ? {
                    id: dept.DeptHead.uuid,
                    username: dept.DeptHead.username,
                    email: dept.DeptHead.email
                } : null
            };
        }));

        res.status(200).json({
            success: true,
            data: formattedDepartments
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

//function for fetching the list of the departments without its users 
const getDeptList = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const departments = await CommonDepts.findAll({
            where: { isDeleted: false },
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

            return { department, updatedFields: { deptName, deptCode, deptHead: headUserId } };
        });

        // Log department update
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'DEPT_UPDATED',
            description: `Department "${result.department.deptName}" updated`,
            userId: req.user.uuid,
            deptId: deptId,
            metadata: {
                updatedFields: result.updatedFields
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Department updated successfully',
            data: {
                deptId: result.department.deptId,
                deptName: result.department.deptName,
                deptCode: result.department.deptCode,
                deptHead: result.department.deptHead
            }
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

//soft delete department
const deleteDepartment = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Find department
            const department = await CommonDepts.findByPk(deptId, { transaction });
            if (!department) {
                throw new Error('Department not found');
            }

            // Find all users in the department
            const departmentUsers = await CommonUsers.findAll({
                where: { 
                    deptId: deptId,
                    isDeleted: false 
                },
                transaction
            });

            // Send emails to all users
            const emailPromises = departmentUsers.map(user => 
                emailService.sendDepartmentDeletionNotice(user, department.deptName)
                    .catch(error => {
                        console.error(`Failed to send email to ${user.email}:`, error);
                        // Continue with deletion even if email fails
                        return null;
                    })
            );

            // Wait for all emails to be sent
            await Promise.all(emailPromises);

            // Delete all users from the department (hard delete)
            await CommonUsers.destroy({
                where: { 
                    deptId: deptId,
                    isDeleted: false 
                },
                force: true, // This ensures hard delete
                transaction
            });

            // Soft delete the department
            await department.update({ 
                isDeleted: true 
            }, { transaction });

            return {
                department,
                usersDeleted: departmentUsers.length
            };
        });

        // Log department deletion
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'DEPT_UPDATED',
            description: `Department "${result.department.deptName}" deleted`,
            userId: req.user.uuid,
            deptId: deptId,
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Department and associated users deleted successfully',
            data: {
                departmentName: result.department.deptName,
                usersDeleted: result.usersDeleted
            }
        });

    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting department',
            error: error.message
        });
    }
};

const restoreDept = async (req, res) => {
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

        await department.update({ isDeleted: false });

        // Log department restoration
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'DEPT_UPDATED',
            description: `Department "${department.deptName}" restored`,
            userId: req.user.uuid,
            deptId: deptId,
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Department restored successfully',
            data: {
                deptId: department.deptId,
                deptName: department.deptName
            }
        });
    }
    catch (error) {
        console.error('Error restoring department:', error);
        res.status(500).json({
            success: false,
            message: 'Error restoring department',
            error: error.message
        });
    }
}

//function for get dept info from common dept table and users  from common users with thier roles and features from {prefix }_user_roles table
const getDepartmentInfo = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonDepts, CommonUsers } = sequelize.models;

        // Get department info with department head
        const department = await CommonDepts.findOne({
            where: { 
                deptId,
                isDeleted: false 
            },
            include: [{
                model: CommonUsers,
                as: 'DeptHead',
                attributes: ['uuid', 'username', 'email'],
                required: false
            }],
            attributes: ['deptId', 'deptName', 'deptCode', 'createdAt']
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Get all users in the department
        const users = await CommonUsers.findAll({
            where: { 
                deptId,
                isDeleted: false 
            },
            attributes: ['uuid', 'username', 'email']
        });

        // Get users with their roles and features using raw queries
        const prefix = `${deptId}_${department.deptCode}`;
        const userRolesQuery = `
            SELECT 
                cu.uuid, cu.username, cu.email,
                r.roleId, r.roleName,
                f.featureId, f.featureName,
                rf.canRead, rf.canWrite, rf.canUpdate, rf.canDelete
            FROM common_users cu
            LEFT JOIN \`${prefix}_user_role\` ur ON cu.uuid = ur.userId
            LEFT JOIN \`${prefix}_role\` r ON ur.roleId = r.roleId
            LEFT JOIN \`${prefix}_role_feature\` rf ON r.roleId = rf.roleId
            LEFT JOIN \`${prefix}_feature\` f ON rf.featureId = f.featureId
            WHERE cu.deptId = :deptId AND cu.isDeleted = false
        `;

        const usersWithRoles = await sequelize.query(userRolesQuery, {
            replacements: { deptId },
            type: sequelize.QueryTypes.SELECT
        });

        // Process and format the results
        const processedUsers = users.map(user => {
            const userRoles = usersWithRoles
                .filter(ur => ur.uuid === user.uuid)
                .reduce((acc, ur) => {
                    if (!ur.roleId) return acc;

                    // Group by role
                    if (!acc[ur.roleId]) {
                        acc[ur.roleId] = {
                            roleId: ur.roleId,
                            roleName: ur.roleName,
                            features: []
                        };
                    }

                    // Add feature to role if it exists
                    if (ur.featureId) {
                        acc[ur.roleId].features.push({
                            featureId: ur.featureId,
                            featureName: ur.featureName,
                            permissions: {
                                canRead: ur.canRead,
                                canWrite: ur.canWrite,
                                canUpdate: ur.canUpdate,
                                canDelete: ur.canDelete
                            }
                        });
                    }

                    return acc;
                }, {});

            return {
                uuid: user.uuid,
                username: user.username,
                email: user.email,
                roles: Object.values(userRoles)
            };
        });

        res.status(200).json({
            success: true,
            data: {
                department: {
                    deptId: department.deptId,
                    deptName: department.deptName,
                    deptCode: department.deptCode,
                    createdAt: department.createdAt,
                    deptHead: department.DeptHead ? {
                        id: department.DeptHead.uuid,
                        username: department.DeptHead.username,
                        email: department.DeptHead.email
                    } : null
                },
                users: processedUsers
            }
        });

    } catch (error) {
        console.error('Error getting department info:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting department info',
            error: error.message
        });
    }
};


//check if dept code is available 
const checkDeptCodeAvailablity = async (req, res) => {
    try {
        const { deptCode } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const department = await CommonDepts.findOne({
            where: { 
                deptCode
            }
        });

        res.status(200).json({
            success: true,
            data: {
                isAvailable: !department
            }
        });
    }
    catch (error) {
        console.error('Error checking department code availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking department code availability',
            error: error.message
        });
    }
}

const editDeptName = async (req, res) => {
    try {
        const { deptId } = req.params;
        const { deptName } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const department = await CommonDepts.findOne({
            where: { 
                deptId
            }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        department.deptName = deptName;
        await department.save();

        res.status(200).json({
            success: true,
            message: 'Department name updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating department name:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating department name',
            error: error.message
        });
    }
}

module.exports = {
    createDepartment,
    getDepartments,
    updateDepartment,
    createDepartmentRole,
    getDepartmentRoles,
    assignFeaturesToRole,
    getDepartmentFeatures,
    deleteDepartment,
    restoreDept,
    getDeptList,
    getDepartmentInfo,
    checkDeptCodeAvailablity,
    editDeptName
};
