const nodemailer = require('nodemailer');

const validateEmail = async (email) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const result = await transporter.verify();
    return result;
};

module.exports = validateEmail;
