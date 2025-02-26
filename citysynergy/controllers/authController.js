// Authentication controller

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDepartmentModels } = require('../utils/dynamicModelGenerator');

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
        const { username, password } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, DevRoles, DevFeatures, DevRoleFeature, DevUserRole } = sequelize.models;

        // Find user
        const user = await CommonUsers.findOne({
            where: { username, isDeleted: false }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
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
            permissions = await DevUserRole.findAll({
                where: { userId: user.uuid },
                include: [{
                    model: DevRoles,
                    as: 'role',
                    include: [{
                        model: DevFeatures,
                        through: DevRoleFeature
                    }]
                }]
            });
        } else if (user.deptId) {
            const department = await CommonDepts.findByPk(user.deptId);
            if (department) {
                const { DeptUserRole, DeptRole, DeptFeature, DeptRoleFeature } = 
                    getDepartmentModels(department.deptId, department.deptCode);
                
                permissions = await DeptUserRole.findAll({
                    where: { userId: user.uuid },
                    include: [{
                        model: DeptRole,
                        as: 'role',
                        include: [{
                            model: DeptFeature,
                            through: DeptRoleFeature
                        }]
                    }]
                });
            }
        }

        // Restructure permissions for easier frontend usage
        const formattedPermissions = permissions.map(p => ({
            roleId: p.role.roleId,
            roleName: p.role.roleName,
            features: p.role.DevFeatures.map(f => ({
                id: f.featureId,
                name: f.featureName,
                description: f.featureDescription,
                permissions: {
                    read: f.DevRoleFeature.canRead,
                    write: f.DevRoleFeature.canWrite,
                    update: f.DevRoleFeature.canUpdate,
                    delete: f.DevRoleFeature.canDelete
                }
            }))
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

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.uuid,
                    username: user.username,
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
                    // Add computed permission helpers
                    can: {
                        manageUsers: hasPermission(formattedPermissions, 'Users Management', 'write'),
                        manageDepartments: hasPermission(formattedPermissions, 'Department Management', 'write'),
                        manageRoles: hasPermission(formattedPermissions, 'Role Management', 'write'),
                        manageFeatures: hasPermission(formattedPermissions, 'Feature Management', 'write'),
                        manageClashes: hasPermission(formattedPermissions, 'Clashes Management', 'write')
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

module.exports = {
    login,
    refreshToken,
    changePassword
};
