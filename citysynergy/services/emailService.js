// Email service

const nodemailer = require('nodemailer');
const {
    getBaseTemplate,
    getWelcomeDevUserContent,
    getWelcomeDeptUserContent,
    getDepartmentHeadContent,
    getPasswordResetContent,
    getRoleAssignmentContent,
    getFirstLoginOTPContent
} = require('../templates/emailTemplates');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    async sendEmail(to, subject, content) {
        try {
            const mailOptions = {
                from: `"City Synergy" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html: getBaseTemplate(content)
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    async sendDevUserEmail(user, tempPassword) {
        const subject = 'Welcome to City Synergy - Developer Account';
        const content = getWelcomeDevUserContent(user.email, tempPassword);
        return this.sendEmail(user.email, subject, content);
    }

    async sendDepartmentUserEmail(user, tempPassword, department) {
        const subject = `Welcome to City Synergy - ${department.deptName}`;
        const content = getWelcomeDeptUserContent(user.email, tempPassword, department);
        return this.sendEmail(user.email, subject, content);
    }

    async sendDepartmentHeadCredentials(user, tempPassword, department) {
        const subject = `City Synergy - Department Head Assignment - ${department.deptName}`;
        const content = getDepartmentHeadContent(user.email, tempPassword, department);
        return this.sendEmail(user.email, subject, content);
    }

    async sendPasswordResetEmail(user, resetLink) {
        const subject = 'City Synergy - Password Reset Request';
        const content = getPasswordResetContent(user.email, resetLink);
        return this.sendEmail(user.email, subject, content);
    }

    async sendRoleAssignmentEmail(user, roles, department = null) {
        const subject = 'City Synergy - Role Assignment Update';
        const content = getRoleAssignmentContent(user.email, roles, department);
        return this.sendEmail(user.email, subject, content);
    }

    async sendFirstLoginOTP(email, otp) {
        const subject = 'City Synergy - First Login Verification';
        const content = getFirstLoginOTPContent(email, otp);
        return this.sendEmail(email, subject, content);
    }
}

module.exports = new EmailService();
