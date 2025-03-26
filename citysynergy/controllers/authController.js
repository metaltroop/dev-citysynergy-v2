// Authentication controller

const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const { getDepartmentModels, getExistingDepartmentModels } = require('../utils/dynamicModelGenerator');
const { withTransaction, withOTPTransaction } = require('../utils/transactionManager');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const { createOtp ,generateTempPassword } = require('../utils/helpers');
const activityLogService = require('../services/activityLogService');

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
            include: [
                {
                    model: CommonDepts,
                    where: { isDeleted: false },
                    required: false
                },
                {
                    model: sequelize.models.UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!user) {
            // No need to log here - the middleware will handle it
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // **First Login Handling with OTP**
        if (user.isFirstLogin && user.needsPasswordChange) {
            const isTempPasswordValid = await bcrypt.compare(password, user.tempPassword);
            if (!isTempPasswordValid) {
                // No need to log here - the middleware will handle it
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const otpRecord = await createOtp(sequelize, user.uuid, 'FIRST_LOGIN');
            await emailService.sendFirstLoginOTP(user.email, otpRecord.otp);

            // Log OTP sent for first login
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'SYSTEM',
                description: `First login OTP sent to ${email}`,
                userId: user.uuid,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: 'OTP sent to email',
                data: { requiresOTP: true, email: user.email }
            });
        }

        // **Password Reset Handling with OTP**
        if (!user.isFirstLogin && user.needsPasswordChange) {
            const isTempPasswordValid = await bcrypt.compare(password, user.tempPassword);
            if (!isTempPasswordValid) {
                // No need to log here - the middleware will handle it
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const otpRecord = await createOtp(sequelize, user.uuid, 'PASSWORD_RESET');
            await emailService.sendPasswordResetOTP(user.email, otpRecord.otp);

            // Log OTP sent for password reset
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'SYSTEM',
                description: `Password reset OTP sent to ${email}`,
                userId: user.uuid,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: 'OTP sent to email',
                data: { requiresOTP: true, email: user.email }
            });
        }

        // **Regular Login Flow**
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            // No need to log here - the middleware will handle it
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate tokens
        const tokens = generateTokens(user);
        let permissions = [];

        if (user.type === 'dev') {
            // **Developer Role Handling (unchanged)**
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
        } else if (user.deptId && user.CommonDept) {
            // **Department-Based Handling Using Raw SQL Query**
            const deptId = user.deptId;
            const deptCode = user.CommonDept.deptCode.toLowerCase();
            const deptTablePrefix = `${deptId}_${deptCode}`;

            // Build raw SQL query. Note: The dept feature table does not have a "description" column.
            const deptQuery = `
                SELECT ur.roleId, r.roleName, f.featureId, f.featureName, 
                       rf.canRead, rf.canWrite, rf.canUpdate, rf.canDelete
                FROM ${deptTablePrefix}_user_role ur
                JOIN ${deptTablePrefix}_role r ON ur.roleId = r.roleId
                JOIN ${deptTablePrefix}_role_feature rf ON r.roleId = rf.roleId
                JOIN ${deptTablePrefix}_feature f ON rf.featureId = f.featureId
                WHERE ur.userId = ?;
            `;

            // Execute raw query
            const rawPermissions = await sequelize.query(deptQuery, {
                replacements: [user.uuid],
                type: sequelize.QueryTypes.SELECT
            });

            // Group raw rows by roleId
            const roleMap = {};
            rawPermissions.forEach(row => {
                if (!roleMap[row.roleId]) {
                    roleMap[row.roleId] = {
                        roleId: row.roleId,
                        roleName: row.roleName,
                        features: []
                    };
                }
                roleMap[row.roleId].features.push({
                    id: row.featureId,
                    name: row.featureName,
                    description: '', // No description column in dept feature table
                    permissions: {
                        read: Boolean(row.canRead),
                        write: Boolean(row.canWrite),
                        update: Boolean(row.canUpdate),
                        delete: Boolean(row.canDelete)
                    }
                });
            });
            permissions = Object.values(roleMap);
        }

        // **Format Permissions**
        let formattedPermissions;
        if (user.type === 'dev') {
            formattedPermissions = permissions.map(p => ({
                roleId: p.role.roleId,
                roleName: p.role.roleName,
                features: (p.role.DevFeatures || p.role.DeptFeatures)?.map(f => ({
                    id: f.featureId,
                    name: f.featureName,
                    description: f.featureDescription || '',
                    permissions: {
                        read: f.DevRoleFeature?.canRead || f.DeptRoleFeature?.canRead || false,
                        write: f.DevRoleFeature?.canWrite || f.DeptRoleFeature?.canWrite || false,
                        update: f.DevRoleFeature?.canUpdate || f.DeptRoleFeature?.canUpdate || false,
                        delete: f.DevRoleFeature?.canDelete || f.DeptRoleFeature?.canDelete || false
                    }
                })) || []
            }));
        } else {
            // For dept users, the raw query already groups data by role.
            formattedPermissions = permissions;
        }

        // **Update Last Login**
        await user.update({ lastLogin: new Date(), isFirstLogin: false });

        // **Set Refresh Token in HTTP-Only Cookie with Enhanced Security**
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,   // Prevents client-side JavaScript access
            secure: process.env.NODE_ENV === 'production',  // Secure in production
            sameSite: 'Strict',  // Protect against CSRF attacks
            path: '/api/auth/',  // Restrict to auth routes
            maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days expiration
        });

        // **Helper Function to Check Permissions**
        const hasPermission = (permissions, featureName, action) => {
            return permissions.some(role =>
                role.features.some(feature =>
                    feature.name === featureName && feature.permissions[action]
                )
            );
        };

        // No need to log successful login here - the middleware will handle it

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.uuid,
                    name: user.username,
                    email: user.email,
                    type: user.type,
                    deptId: user.deptId,
                    profileImage: user.UserImages && user.UserImages.length > 0 ? user.UserImages[0].imageUrl : null,
                    state: {
                        needsPasswordChange: user.needsPasswordChange,
                        isFirstLogin: user.isFirstLogin
                    }
                },
                permissions: {
                    roles: formattedPermissions,
                    can: {
                        manageUsers: hasPermission(formattedPermissions, 'Users Management', 'write'),
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
        res.status(500).json({ success: false, message: error.message });
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
        // Read refresh token from cookies instead of req.body
        const refreshToken = req.cookies?.refreshToken;
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
            // Log failed password change attempt
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'USER_UPDATED',
                description: `Failed password change attempt for ${user.email} (invalid current password)`,
                userId: uuid,
                ipAddress: req.ip
            });
            
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

        // Log successful password change
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'USER_UPDATED',
            description: `Password changed successfully for ${user.email}`,
            userId: uuid,
            ipAddress: req.ip
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
        const { CommonUsers, OTP } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { email, needsPasswordChange: true }
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
            // Log failed OTP verification
            await activityLogService.createActivityLog(sequelize, {
                activityType: 'SYSTEM',
                description: `Failed OTP verification for ${email}`,
                userId: user.uuid,
                ipAddress: req.ip
            });
            
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

        // Log successful password set after OTP verification
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'USER_UPDATED',
            description: `Password set after OTP verification for ${email}`,
            userId: user.uuid,
            ipAddress: req.ip
        });

        // Simple success response
        res.status(200).json({
            success: true,
            message: 'Password has been changed to the new password'
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

//function to reset pass and send otp this will delete the current password and generate a new  temp password and send otp to the user email 
const resetPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;
        const user = await CommonUsers.findOne({ where: { uuid: userId, isDeleted: false } });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        await user.update({ tempPassword: hashedPassword, needsPasswordChange: true });
        await emailService.sendPasswordResetEmail(user, tempPassword);
        
        // Log password reset
        await activityLogService.createActivityLog(sequelize, {
            activityType: 'USER_UPDATED',
            description: `Password reset initiated for ${user.email}`,
            userId: req.user.uuid, // Admin who initiated the reset
            metadata: {
                targetUserId: userId
            },
            ipAddress: req.ip
        });
        
        res.status(200).json({
            success: true,
            message: 'Password reset email sent successfully for user ' + user.email
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

// Add logout function
const logout = async (req, res) => {
    try {
      const { sequelize } = req.app.locals;
  
      // Optionally log logout activity
      await activityLogService.createActivityLog(sequelize, {
        activityType: "LOGOUT",
        description: "User logged out",
        userId: req.user.uuid,
        ipAddress: req.ip,
      });
  
        // Clear refresh token cookie
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: '/api/auth/'
       
      });
  
      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        success: false,
        message: "Error during logout",
        error: error.message,
      });
    }
  };
  

module.exports = {
    login,
    refreshToken,
    changePassword,
    verifyOtpAndSetNewPassword,
    resetPassword,
    logout
};
