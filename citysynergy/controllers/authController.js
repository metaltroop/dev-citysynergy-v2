// Authentication controller

const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const { getDepartmentModels, getExistingDepartmentModels } = require('../utils/dynamicModelGenerator');
const { withTransaction, withOTPTransaction } = require('../utils/transactionManager');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const { createOtp } = require('../utils/helpers');

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { uuid: user.uuid, type: user.type, deptId: user.deptId },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { uuid: user.uuid },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRY }
    );
 
    return { accessToken, refreshToken };
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, DevRoles, DevFeatures, DevRoleFeature, DevUserRole } = sequelize.models;

        // Find user by email with department information
        const user = await CommonUsers.findOne({
            where: { email, isDeleted: false },
            include: [{
                model: CommonDepts,
                where: { isDeleted: false },
                required: false
            }]
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if first login and needs password change
        if (user.isFirstLogin && user.needsPasswordChange) {
            // Verify temporary password
            const isTempPasswordValid = await bcrypt.compare(password, user.tempPassword);
            if (!isTempPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Create OTP and get the value
            const otpRecord = await createOtp(sequelize, user.uuid, 'FIRST_LOGIN');

            // Send OTP email
            await emailService.sendFirstLoginOTP(user.email, otpRecord.otp);

            return res.status(200).json({
                success: true,
                message: 'OTP sent to email',
                data: {
                    requiresOTP: true,
                    email: user.email
                }
            });
        }

        // Regular login flow
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const tokens = generateTokens(user);

        // Get user permissions
        let permissions = [];
        if (user.type === 'dev') {
            // Fetch permissions for dev users
            permissions = await DevUserRole.findAll({
                where: { userId: user.uuid },
                include: [{
                    model: DevRoles,
                    as: 'role',
                    include: [{
                        model: DevFeatures,
                        through: {
                            model: DevRoleFeature,
                            attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                        }
                    }]
                }]
            });
        } else if (user.deptId && user.CommonDept) {  // Check if department exists
            try {
                const deptModels = getExistingDepartmentModels(user.deptId, user.CommonDept.deptCode.toUpperCase()); // Ensure uppercase
                permissions = await deptModels.DeptUserRole.findAll({
                    where: { userId: user.uuid },
                    include: [{
                        model: deptModels.DeptRole,
                        as: 'role',
                        include: [{
                            model: deptModels.DeptFeature,
                            through: {
                                model: deptModels.DeptRoleFeature,
                                attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                            }
                        }]
                    }]
                });
            } catch (modelError) {
                console.error('Error fetching department models:', modelError);
                throw new Error(`Department configuration not found for ${user.CommonDept.deptCode}`);
            }
        }

        // Format permissions
        const formattedPermissions = permissions.map(p => ({
            roleId: p.role.roleId,
            roleName: p.role.roleName,
            features: p.role.DevFeatures || p.role.DeptFeatures ? 
                (p.role.DevFeatures || p.role.DeptFeatures).map(f => ({
                    id: f.featureId,
                    name: f.featureName,
                    description: f.description,
                    permissions: {
                        read: f.DevRoleFeature?.canRead || f.DeptRoleFeature?.canRead || false,
                        write: f.DevRoleFeature?.canWrite || f.DeptRoleFeature?.canWrite || false,
                        update: f.DevRoleFeature?.canUpdate || f.DeptRoleFeature?.canUpdate || false,
                        delete: f.DevRoleFeature?.canDelete || f.DeptRoleFeature?.canDelete || false
                    }
                })) : []
        }));

        // Update last login
        await user.update({ 
            lastLogin: new Date(),
            isFirstLogin: false
        });

        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Helper function to check permissions
        const hasPermission = (permissions, featureName, action) => {
            return permissions.some(role => 
                role.features.some(feature => 
                    feature.name === featureName && feature.permissions[action]
                )
            );
        };

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.uuid,
                    email: user.email,
                    type: user.type,
                    deptId: user.deptId,
                    state: {
                        needsPasswordChange: user.needsPasswordChange,
                        isFirstLogin: user.isFirstLogin
                    }
                },
                permissions: {
                    roles: formattedPermissions,
                    can: {
                        manageUsers: hasPermission(formattedPermissions, 'User Management', 'write'),
                        manageDepartments: hasPermission(formattedPermissions, 'Department Management', 'write'),
                        manageRoles: hasPermission(formattedPermissions, 'Role Management', 'write'),
                        manageFeatures: hasPermission(formattedPermissions, 'Feature Management', 'write'),
                        manageInventory: hasPermission(formattedPermissions, 'Inventory Management', 'write'),
                        manageIssues: hasPermission(formattedPermissions, 'Issue Management', 'write'),
                        manageReports: hasPermission(formattedPermissions, 'Reports Management', 'write'),
                        manageAttendance: hasPermission(formattedPermissions, 'Attendance Management', 'write'),
                        manageTasks: hasPermission(formattedPermissions, 'Task Management', 'write')
                    }
                },
                accessToken: tokens.accessToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login',
            error: error.message
        });
    }
};

// Helper function to check permissions
const hasPermission = (roles, featureName, action) => {
    return roles.some(role => 
        role.features.some(feature => 
            feature.name === featureName && feature.permissions[action]
        )
    );
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        // Get user
        const user = await CommonUsers.findOne({
            where: { uuid: decoded.uuid, isDeleted: false }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Generate new tokens
        const tokens = generateTokens(user);

        res.status(200).json({
            success: true,
            data: { tokens }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        const user = await CommonUsers.findByPk(uuid);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await user.update({
            password: hashedPassword,
            needsPasswordChange: false
        });

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};

const verifyOtpAndSetNewPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Check if newPassword is provided
        if (!newPassword || typeof newPassword !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        const { sequelize } = req.app.locals;
        const { CommonUsers, OTP, DevUserRole, DevRoles, DevFeatures, DevRoleFeature } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { email, isFirstLogin: true, needsPasswordChange: true }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user state for password change'
            });
        }

        // Verify OTP
        const otpRecord = await OTP.findOne({
            where: {
                userId: user.uuid,
                otp,
                isUsed: false,
                expiresAt: { [Op.gt]: new Date() }
            }
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user
        await user.update({
            password: hashedPassword,
            tempPassword: null,
            isFirstLogin: false,
            needsPasswordChange: false
        });

        // Mark OTP as used
        await otpRecord.update({ isUsed: true });

        // Fetch user permissions based on user type
        let permissions = [];
        if (user.type === 'dev') {
            permissions = await DevUserRole.findAll({
                where: { userId: user.uuid },
                include: [{
                    model: DevRoles,
                    as: 'role',
                    include: [{
                        model: DevFeatures,
                        through: {
                            model: DevRoleFeature,
                            attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                        }
                    }]
                }]
            });
        } else if (user.deptId) {
            const department = await sequelize.models.CommonDepts.findByPk(user.deptId);
            if (department) {
                const deptModels = getDepartmentModels(user.deptId, department.deptCode);
                permissions = await deptModels.DeptUserRole.findAll({
                    where: { userId: user.uuid },
                    include: [{
                        model: deptModels.DeptRole,
                        include: [{
                            model: deptModels.DeptFeature,
                            through: {
                                model: deptModels.DeptRoleFeature,
                                attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                            }
                        }]
                    }]
                });
            }
        }

        // Format permissions
        const formattedPermissions = permissions.map(p => ({
            roleId: p.role.roleId,
            roleName: p.role.roleName,
            features: p.role.DevFeatures || p.role.DeptFeatures ? 
                (p.role.DevFeatures || p.role.DeptFeatures).map(f => ({
                    id: f.featureId,
                    name: f.featureName,
                    description: f.description,
                    permissions: {
                        read: f.DevRoleFeature?.canRead || f.DeptRoleFeature?.canRead || false,
                        write: f.DevRoleFeature?.canWrite || f.DeptRoleFeature?.canWrite || false,
                        update: f.DevRoleFeature?.canUpdate || f.DeptRoleFeature?.canUpdate || false,
                        delete: f.DevRoleFeature?.canDelete || f.DeptRoleFeature?.canDelete || false
                    }
                })) : []
        }));

        // Generate tokens as before...

        res.status(200).json({
            success: true,
            message: 'Password set successfully',
            data: {
                user: {
                    id: user.uuid,
                    email: user.email,
                    type: user.type,
                    deptId: user.deptId,
                    state: {
                        needsPasswordChange: false,
                        isFirstLogin: false
                    }
                },
                permissions: {
                    roles: formattedPermissions,
                    can: {
                        manageUsers: hasPermission(formattedPermissions, 'User Management', 'write'),
                        manageDepartments: hasPermission(formattedPermissions, 'Department Management', 'write'),
                        manageRoles: hasPermission(formattedPermissions, 'Role Management', 'write'),
                        manageFeatures: hasPermission(formattedPermissions, 'Feature Management', 'write'),
                        manageInventory: hasPermission(formattedPermissions, 'Inventory Management', 'write'),
                        manageIssues: hasPermission(formattedPermissions, 'Issue Management', 'write'),
                        manageReports: hasPermission(formattedPermissions, 'Reports Management', 'write'),
                        manageAttendance: hasPermission(formattedPermissions, 'Attendance Management', 'write'),
                        manageTasks: hasPermission(formattedPermissions, 'Task Management', 'write')
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error setting password:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting password',
            error: error.message
        });
    }
};

module.exports = {
    login,
    refreshToken,
    changePassword,
    verifyOtpAndSetNewPassword
};
