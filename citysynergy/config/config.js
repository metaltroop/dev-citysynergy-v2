// Configuration settings for the application

require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'citysynergydb'
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
        accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    }
};

