// General utility functions

const generateCustomId = async (model, prefix, field = 'id') => {
    const lastRecord = await model.findOne({
        order: [['createdAt', 'DESC']]
    });

    let nextNumber = 1;
    if (lastRecord) {
        const lastId = lastRecord[field];
        const numberPart = parseInt(lastId.slice(-3));
        nextNumber = numberPart + 1;
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
};

const generateTempPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
};

module.exports = {
    generateCustomId,
    generateTempPassword
};
