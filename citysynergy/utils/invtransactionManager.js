const { Op } = require('sequelize');

const withTransaction = async (callback, sequelize) => {
    const transaction = await sequelize.transaction();
    
    try {
        const result = await callback(transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

// Add specific transaction handlers for common operations
const withOTPTransaction = async (email, otp, newPassword, callback, sequelize) => {
    return withTransaction(async (transaction) => {
        const { CommonUsers, OTP } = sequelize.models;
        
        // Verify OTP
        const validOtp = await OTP.findOne({
            where: {
                email,
                otp,
                isUsed: false,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            },
            transaction,
            lock: transaction.LOCK.UPDATE // Add lock to prevent race conditions
        });

        if (!validOtp) {
            throw new Error('Invalid or expired OTP');
        }

        // Execute the callback with transaction
        const result = await callback(transaction);

        // Mark OTP as used
        await validOtp.update({ isUsed: true }, { transaction });

        return result;
    }, sequelize);
};

module.exports = {
    withTransaction,
    withOTPTransaction
}; 