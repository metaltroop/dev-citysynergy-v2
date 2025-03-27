const { Op } = require('sequelize');

const atwithTransaction = async (sequelize, callback) => {
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

module.exports = {
    atwithTransaction,
};