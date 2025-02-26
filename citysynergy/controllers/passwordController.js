const bcrypt = require('bcrypt');
const { withTransaction } = require('../utils/transactionManager');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { uuid, isDeleted: false }
        });
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

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({
            password: hashedPassword,
            needsPasswordChange: false
        });

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        const user = await CommonUsers.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { uuid: user.uuid },
            process.env.JWT_RESET_SECRET,
            { expiresIn: '1h' }
        );

        // Save reset token hash
        const hashedToken = await bcrypt.hash(resetToken, 10);
        await user.update({
            tempPassword: hashedToken,
            needsPasswordChange: true
        });

        // Send reset email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        await emailService.sendPasswordResetEmail(user, resetLink);

        res.status(200).json({
            success: true,
            message: 'Password reset link sent to email'
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing forgot password request',
            error: error.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;

        const user = await CommonUsers.findByPk(decoded.uuid);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify token hash
        const isValidToken = await bcrypt.compare(token, user.tempPassword);
        if (!isValidToken) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({
            password: hashedPassword,
            tempPassword: null,
            needsPasswordChange: false
        });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
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

module.exports = {
    changePassword,
    forgotPassword,
    resetPassword
}; 