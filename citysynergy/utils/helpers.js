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
    const length = 8;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijkmnopqrstuvwxyz";
    const numbers = "0123456789";
    
    // Ensure at least one of each type
    let password = 
        uppercase[Math.floor(Math.random() * uppercase.length)] +
        lowercase[Math.floor(Math.random() * lowercase.length)] +
        numbers[Math.floor(Math.random() * numbers.length)];
    
    // Fill the rest randomly
    const charset = uppercase + lowercase + numbers;
    for (let i = password.length; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

const createOtp = async (sequelize, userId, purpose) => {
    const { OTP } = sequelize.models;

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return await OTP.create({
        userId,
        otp,
        purpose, 
        expiresAt
    });
};

module.exports = {
    generateCustomId,
    generateTempPassword,
    createOtp
};
