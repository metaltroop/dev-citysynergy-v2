const sequelize = require('../config/database');

const withTransaction = async (operations) => {
    const transaction = await sequelize.transaction();
    try {
        const result = await operations(transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

module.exports = {
    withTransaction
}; 