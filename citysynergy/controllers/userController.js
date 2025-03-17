// User controller

const { withTransaction } = require('../utils/transactionManager');
const emailService = require('../services/emailService');
const bcrypt = require('bcrypt');
const { generateCustomId, generateTempPassword, getDepartmentModels } = require('../utils/helpers');
const { Op } = require('sequelize');
const activityLogService = require('../services/activityLogService');

// Helper function to format user data
const formatUserData = (user, department = null, role = null) => ({
    id: user.uuid,
    username: user.username,
    email: user.email,
    type: user.type,
    deptId: user.deptId,
    profileImage: user.UserImages && user.UserImages.length > 0 ? user.UserImages[0].imageUrl : null,
    department: department ? {
        id: department.deptId,
        name: department.deptName,
        code: department.deptCode
    } : null,
    role: role ? {
        id: role.roleId,
        name: role.roleName
    } : null, // Include role object with id and name
    state: {
        isFirstLogin: user.isFirstLogin,
        needsPasswordChange: user.needsPasswordChange,
        lastLogin: user.lastLogin
    }
    // roles will be added in the getUsers function
});

const createUser = async (req, res) => {
    try {
        const { username, email, type = 'dept', deptId, roleId } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, DevUserRole, DevRoles } = sequelize.models;

        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: 'Username and email are required'
            });
        }

        const result = await withTransaction(async (transaction) => {
            // Validate department if deptId is provided
            let department;
            if (deptId) {
                department = await CommonDepts.findOne({
                    where: { deptId, isDeleted: false },
                    transaction
                });
                if (!department) {
                    throw new Error('Department not found or inactive');
                }
            }

            // Generate temporary password
            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Create user
            const user = await CommonUsers.create({
                username,
                password: null,
                tempPassword: hashedPassword,
                email,
                type,
                deptId: deptId || null,
                isFirstLogin: true,
                needsPasswordChange: true
            }, { transaction });

            let role = null; // Variable to store the role details (id and name)

            // Handle role if provided
            if (roleId) {
                if (user.type === 'dev') {
                    // Validate dev role exists
                    const existingRole = await DevRoles.findOne({
                        where: { roleId },
                        transaction
                    });

                    if (!existingRole) {
                        throw new Error(`Invalid dev role ID: ${roleId}`);
                    }

                    // Add single role
                    await DevUserRole.create({
                        userId: user.uuid,
                        roleId
                    }, { transaction });

                    role = {
                        roleId: existingRole.roleId,
                        roleName: existingRole.roleName
                    }; // Store role details
                } else if (user.type === 'dept') {
                    if (!department) {
                        throw new Error('Cannot assign role to department user without valid department');
                    }

                    // Validate department role exists and fetch role name
                    const roleTableName = `${department.deptId}_${department.deptCode}_role`;
                    const [existingRole] = await sequelize.query(
                        `SELECT roleId, roleName FROM \`${roleTableName}\` 
                         WHERE roleId = :roleId LIMIT 1`,
                        {
                            replacements: { roleId },
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        }
                    );

                    if (!existingRole) {
                        throw new Error(`Invalid department role ID: ${roleId}`);
                    }

                    // Insert single role with timestamps
                    const userRoleTableName = `${department.deptId}_${department.deptCode}_user_role`;
                    const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    await sequelize.query(
                        `INSERT INTO \`${userRoleTableName}\` (userId, roleId, createdAt, updatedAt) 
                         VALUES (:userId, :roleId, :createdAt, :updatedAt)`,
                        {
                            replacements: { 
                                userId: user.uuid, 
                                roleId, 
                                createdAt: currentTimestamp, 
                                updatedAt: currentTimestamp 
                            },
                            transaction,
                            type: sequelize.QueryTypes.INSERT
                        }
                    );

                    role = {
                        roleId: existingRole.roleId,
                        roleName: existingRole.roleName
                    }; // Store role details
                }
            }

            // Handle email notifications
            if (type === 'dev') {
                await emailService.sendDevUserEmail(user, tempPassword);
            } else if (deptId && department) {
                await emailService.sendDepartmentUserEmail(user, tempPassword, department);
            }

            // Log user creation
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'USER_CREATED',
                description: `New user "${user.username}" created`,
                userId: req.user?.uuid, // The admin who performed the action
                deptId: user.deptId,
                metadata: {
                    newUserId: user.uuid,
                    userType: user.type,
                    roleId: roleId
                },
                ipAddress: req.ip
            });

            return { user, department, tempPassword, role }; // Include role details in the result
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: formatUserData(result.user, result.department, result.role) // Pass role to formatUserData
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
        const { CommonUsers, CommonDepts, UserImage } = sequelize.models;

        const whereClause = {
            isDeleted: false
        };

        if (type) whereClause.type = type;
        if (deptId) whereClause.deptId = deptId;

        const users = await CommonUsers.findAll({
            where: whereClause,
            attributes: ['uuid', 'username', 'email', 'type', 'deptId', 'lastLogin'],
            include: [
                {
                    model: CommonDepts,
                    attributes: ['deptName', 'deptCode'],
                    required: false
                },
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        // Format the response to include profile images
        const formattedUsers = users.map(user => ({
            id: user.uuid,
            username: user.username,
            email: user.email,
            type: user.type,
            deptId: user.deptId,
            department: user.CommonDept ? {
                name: user.CommonDept.deptName,
                code: user.CommonDept.deptCode
            } : null,
            lastLogin: user.lastLogin,
            profileImage: user.UserImages && user.UserImages.length > 0 ? user.UserImages[0].imageUrl : null
        }));

        res.status(200).json({
            success: true,
            data: formattedUsers
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

        // Log user update
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'USER_UPDATED',
            description: `User "${result.email}" updated`,
            userId: req.user.uuid,
            deptId: result.deptId,
            metadata: {
                targetUserId: uuid,
                updatedFields: Object.keys(req.body)
            },
            ipAddress: req.ip
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

//delete user api by uuid which will set the isDeleted flag to true but first it will check if its deptId is null or not if it is then it should not delete the user
const deleteUser = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        const user = await CommonUsers.findByPk(uuid);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.deptId === null) {
            await user.update({ isDeleted: true });
            
            // Log user deletion
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'USER_UPDATED',
                description: `User "${user.email}" deleted`,
                userId: req.user.uuid,
                metadata: {
                    targetUserId: uuid
                },
                ipAddress: req.ip
            });
            
            return res.status(200).json({
                success: true,
                message: 'User deleted successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'User is assigned to a department and cannot be deleted'
            });
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
        }
}

const getUsers = async (req, res) => {
    try {
        const { type, deptId } = req.query;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, DevUserRole, DevRoles, UserImage } = sequelize.models;

        const whereClause = { isDeleted: false };
        if (type) whereClause.type = type;
        if (deptId) whereClause.deptId = deptId;

        const users = await CommonUsers.findAll({
            where: whereClause,
            include: [
                {
                    model: CommonDepts,
                    where: { isDeleted: false },
                    attributes: ['deptId', 'deptName', 'deptCode'],
                    required: false
                },
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ],
            attributes: [
                'uuid', 'username', 'email', 'type', 'deptId',
                'isFirstLogin', 'needsPasswordChange', 'lastLogin'
            ]
        });

        // Process each user to include roles
        const processedUsers = await Promise.all(users.map(async (user) => {
            let roles = [];
            
            // Only process department roles if department exists and is not deleted
            if (user.type === 'dev') {
                const devRoles = await DevUserRole.findAll({
                    where: { userId: user.uuid },
                    include: [{
                        model: DevRoles,
                        as: 'role',
                        attributes: ['roleId', 'roleName']
                    }],
                    attributes: ['roleId']
                });
                roles = devRoles.map(role => ({
                    id: role.roleId,
                    name: role.role?.roleName || 'Unknown Role'
                }));
            } else if (user.deptId && user.CommonDept) {
                const userRoleTableName = `${user.deptId}_${user.CommonDept.deptCode}_user_role`;
                const roleTableName = `${user.deptId}_${user.CommonDept.deptCode}_role`;
                
                const roleResults = await sequelize.query(
                    `SELECT ur.roleId, r.roleName
                     FROM \`${userRoleTableName}\` ur
                     LEFT JOIN \`${roleTableName}\` r ON ur.roleId = r.roleId
                     WHERE ur.userId = :userId`,
                    {
                        replacements: { userId: user.uuid },
                        type: sequelize.QueryTypes.SELECT
                    }
                ).catch(err => {
                    console.warn(`Error fetching roles from ${userRoleTableName}:`, err);
                    return []; 
                });

                roles = roleResults.map(role => ({
                    id: role.roleId,
                    name: role.roleName || 'Unknown Role'
                }));
            }

            const formattedUser = formatUserData(user, user.CommonDept);
            return {
                ...formattedUser,
                roles
            };
        }));

        res.status(200).json({
            success: true,
            data: processedUsers
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
        const { CommonUsers, CommonDepts, UserImage } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { uuid, isDeleted: false },
            include: [
                {
                    model: CommonDepts,
                    attributes: ['deptId', 'deptName', 'deptCode']
                },
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ],
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

const checkUsernameAvailability = async (req, res) => {
    try {
        const { username } = req.body;

        // Validate input
        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        const existingUser = await CommonUsers.findOne({
            where: {
                username,
                isDeleted: false
            }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Username is available'
        });
    } catch (error) {
        console.error('Error checking username availability:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking username availability',
            error: error.message
        });
    }
};

const checkEmailAvailability = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;    

        const existingUser = await CommonUsers.findOne({
            where: {
                email,
                isDeleted: false
            }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }    

        return res.status(200).json({
            success: true,
            message: 'Email is available'
        });
    } catch (error) {
        console.error('Error checking email availability:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking email availability',
            error: error.message
        });
    }
};

const getUnassignedUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const { sequelize } = req.app.locals;
        const { CommonUsers, UserImage } = sequelize.models;
        
        const whereClause = {
            type: 'dept',
            deptId: null,
            isDeleted: false
        };

        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ];
        }

        const users = await CommonUsers.findAll({
            where: whereClause,
            attributes: ['uuid', 'username', 'email'],
            include: [
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ],
            limit: 10
        });

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No unassigned users found'
            });
        }

        // Format the response to include profile images
        const formattedUsers = users.map(user => ({
            id: user.uuid,
            username: user.username,
            email: user.email,
            profileImage: user.UserImages && user.UserImages.length > 0 ? user.UserImages[0].imageUrl : null
        }));

        res.status(200).json({
            success: true,
            data: formattedUsers
        });
    } catch (error) {
        console.error('Error getting unassigned users:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unassigned users',
            error: error.message
        });
    }
};

// Get users from the same department as the logged-in user
const getDeptUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const { deptId } = req.user; // Get deptId from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, UserImage } = sequelize.models;
        
        // Build where clause to find users in the same department
        const whereClause = {
            type: 'dept',
            deptId: deptId,
            isDeleted: false
        };

        // Add search functionality if provided
        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ];
        }

        // Get department info to fetch role data
        const department = await CommonDepts.findOne({
            where: { deptId, isDeleted: false },
            attributes: ['deptId', 'deptName', 'deptCode']
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        // Fetch users from the same department
        const users = await CommonUsers.findAll({
            where: whereClause,
            include: [
                {
                    model: CommonDepts,
                    attributes: ['deptId', 'deptName', 'deptCode'],
                    required: true
                },
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ],
            attributes: [
                'uuid', 'username', 'email', 'type', 'deptId',
                'isFirstLogin', 'needsPasswordChange', 'lastLogin'
            ]
        });

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No users found in your department'
            });
        }

        // Process each user to include roles using raw SQL for department-specific tables
        const processedUsers = await Promise.all(users.map(async (user) => {
            // Get user roles from department-specific tables
            const userRoleTableName = `${deptId}_${department.deptCode}_user_role`;
            const roleTableName = `${deptId}_${department.deptCode}_role`;
            
            // Use raw SQL to query the dynamically created tables
            const roleResults = await sequelize.query(
                `SELECT ur.roleId, r.roleName
                 FROM \`${userRoleTableName}\` ur
                 LEFT JOIN \`${roleTableName}\` r ON ur.roleId = r.roleId
                 WHERE ur.userId = :userId`,
                {
                    replacements: { userId: user.uuid },
                    type: sequelize.QueryTypes.SELECT
                }
            ).catch(err => {
                console.warn(`Error fetching roles from ${userRoleTableName}:`, err);
                return []; 
            });

            const roles = roleResults.map(role => ({
                id: role.roleId,
                name: role.roleName || 'Unknown Role'
            }));

            // Format user data with department and roles
            const formattedUser = formatUserData(user, user.CommonDept);
            return {
                ...formattedUser,
                roles
            };
        }));

        res.status(200).json({
            success: true,
            data: processedUsers
        });
    } catch (error) {
        console.error('Error getting department users:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting department users',
            error: error.message
        });
    }
};

// Get a specific user from the logged-in user's department by ID
const getDeptuserById = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { deptId } = req.user; // Get deptId from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, UserImage } = sequelize.models;
        
        // Get department info to fetch role data
        const department = await CommonDepts.findOne({
            where: { deptId, isDeleted: false },
            attributes: ['deptId', 'deptName', 'deptCode']
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        // Fetch the specific user from the same department
        const user = await CommonUsers.findOne({
            where: { 
                uuid,
                deptId,
                isDeleted: false 
            },
            include: [
                {
                    model: CommonDepts,
                    attributes: ['deptId', 'deptName', 'deptCode'],
                    required: true
                },
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ],
            attributes: [
                'uuid', 'username', 'email', 'type', 'deptId',
                'isFirstLogin', 'needsPasswordChange', 'lastLogin'
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found in your department'
            });
        }

        // Get user roles from department-specific tables using raw SQL
        const userRoleTableName = `${deptId}_${department.deptCode}_user_role`;
        const roleTableName = `${deptId}_${department.deptCode}_role`;
        
        const roleResults = await sequelize.query(
            `SELECT ur.roleId, r.roleName
             FROM \`${userRoleTableName}\` ur
             LEFT JOIN \`${roleTableName}\` r ON ur.roleId = r.roleId
             WHERE ur.userId = :userId`,
            {
                replacements: { userId: user.uuid },
                type: sequelize.QueryTypes.SELECT
            }
        ).catch(err => {
            console.warn(`Error fetching roles from ${userRoleTableName}:`, err);
            return []; 
        });

        const roles = roleResults.map(role => ({
            id: role.roleId,
            name: role.roleName || 'Unknown Role'
        }));

        // Format user data with department and roles
        const formattedUser = formatUserData(user, user.CommonDept);
        const processedUser = {
            ...formattedUser,
            roles,
            profileImage: user.UserImages && user.UserImages.length > 0 ? user.UserImages[0].imageUrl : null
        };

        res.status(200).json({
            success: true,
            data: processedUser
        });
    } catch (error) {
        console.error('Error getting department user by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting department user by ID',
            error: error.message
        });
    }
};

// Create a new user in the logged-in user's department
const createUserForDept = async (req, res) => {
    try {
        const { username, email, roleId } = req.body;
        const { deptId, uuid: creatorId } = req.user; // Get deptId and creator ID from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        if (!username || !email || !roleId) {
            return res.status(400).json({
                success: false,
                message: 'Username, email, and roleId are required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Get department info to validate and for table names
            const department = await CommonDepts.findOne({
                where: { deptId, isDeleted: false },
                transaction
            });

            if (!department) {
                throw new Error('Department not found or inactive');
            }

            // Validate that the role exists in the department's role table
            const roleTableName = `${deptId}_${department.deptCode}_role`;
            const [existingRole] = await sequelize.query(
                `SELECT roleId, roleName FROM \`${roleTableName}\` 
                 WHERE roleId = :roleId AND isDeleted = 0 LIMIT 1`,
                {
                    replacements: { roleId },
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (!existingRole) {
                throw new Error(`Invalid role ID for department: ${roleId}`);
            }

            // Generate temporary password
            const tempPassword = generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Create user with department ID from token
            const user = await CommonUsers.create({
                username,
                password: null,
                tempPassword: hashedPassword,
                email,
                type: 'dept', // Always 'dept' type for department users
                deptId: deptId,
                isFirstLogin: true,
                needsPasswordChange: true
            }, { transaction });

            // Insert role assignment in the department's user_role table
            const userRoleTableName = `${deptId}_${department.deptCode}_user_role`;
            const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await sequelize.query(
                `INSERT INTO \`${userRoleTableName}\` (userId, roleId, createdAt, updatedAt) 
                 VALUES (:userId, :roleId, :createdAt, :updatedAt)`,
                {
                    replacements: { 
                        userId: user.uuid, 
                        roleId, 
                        createdAt: currentTimestamp, 
                        updatedAt: currentTimestamp 
                    },
                    transaction,
                    type: sequelize.QueryTypes.INSERT
                }
            );

            // Send email notification
            await emailService.sendDepartmentUserEmail(user, tempPassword, department);

            // Log user creation
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'USER_CREATED',
                description: `New department user "${user.username}" created`,
                userId: creatorId,
                deptId: deptId,
                metadata: {
                    newUserId: user.uuid,
                    userType: 'dept',
                    roleId: roleId,
                    roleName: existingRole.roleName
                },
                ipAddress: req.ip
            }, transaction);

            return { 
                user, 
                department, 
                tempPassword, 
                role: {
                    roleId: existingRole.roleId,
                    roleName: existingRole.roleName
                }
            };
        });

        res.status(201).json({
            success: true,
            message: 'Department user created successfully',
            data: formatUserData(result.user, result.department, result.role)
        });

    } catch (error) {
        console.error('Error creating department user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating department user',
            error: error.message
        });
    }
};

// Edit a user in the logged-in user's department (only username)
const editDeptUserById = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { username } = req.body;
        const { deptId, uuid: editorId } = req.user; // Get deptId and editor ID from the authenticated user's token
        
        // If user doesn't have a department, return error
        if (!deptId) {
            return res.status(403).json({
                success: false,
                message: 'You are not associated with any department'
            });
        }

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const result = await withTransaction(async (transaction) => {
            // Get department info to validate
            const department = await CommonDepts.findOne({
                where: { deptId, isDeleted: false },
                transaction
            });

            if (!department) {
                throw new Error('Department not found or inactive');
            }

            // Find the user and ensure they belong to the same department
            const user = await CommonUsers.findOne({
                where: { 
                    uuid,
                    deptId,
                    isDeleted: false 
                },
                transaction
            });

            if (!user) {
                throw new Error('User not found in your department');
            }

            // Update only the username
            await user.update({ username }, { transaction });

            // Log user update
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'USER_UPDATED',
                description: `Department user "${user.email}" username updated`,
                userId: editorId,
                deptId: deptId,
                metadata: {
                    targetUserId: uuid,
                    oldUsername: user.username,
                    newUsername: username
                },
                ipAddress: req.ip
            }, transaction);

            return { user, department };
        });

        res.status(200).json({
            success: true,
            message: 'Department user updated successfully',
            data: formatUserData(result.user, result.department)
        });

    } catch (error) {
        console.error('Error updating department user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating department user',
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
    checkEmailAvailability,
    checkUsernameAvailability,
    getUser,
    getUnassignedUsers,
    getDeptUsers,
    getDeptuserById,
    createUserForDept,
    editDeptUserById
};
