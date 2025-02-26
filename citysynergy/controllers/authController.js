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
        const { CommonUsers, CommonDepts } = sequelize.models;

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
            const { DevRole, DevFeature, DevRoleFeature, DevUserRole } = sequelize.models;
            permissions = await DevUserRole.findAll({
                where: { userId: user.uuid },
                include: [{
                    model: DevRole,
                    include: [{
                        model: DevFeature,
                        through: DevRoleFeature
                    }]
                }]
            });
        } else if (user.deptId) {
            const department = await CommonDepts.findByPk(user.deptId);
            if (department) {
                const deptModels = getDepartmentModels(user.deptId, department.deptCode);
                permissions = await deptModels.DeptUserRole.findAll({
                    where: { userId: user.uuid },
                    include: [{
                        model: deptModels.DeptRole,
                        include: [{
                            model: deptModels.DeptFeature,
                            through: deptModels.DeptRoleFeature
                        }]
                    }]
                });
            }
        }

        // Update last login
        await user.update({ 
            lastLogin: new Date(),
            isFirstLogin: false
        });

        res.status(200).json({
            success: true,
            data: {
                user: {
                    uuid: user.uuid,
                    username: user.username,
                    email: user.email,
                    type: user.type,
                    deptId: user.deptId,
                    needsPasswordChange: user.needsPasswordChange,
                    isFirstLogin: user.isFirstLogin
                },
                permissions,
                tokens
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
