// Email service

const nodemailer = require('nodemailer');
const {
    getBaseTemplate,
    getWelcomeDevUserContent,
    getWelcomeDeptUserContent,
    getDepartmentHeadContent,
    getPasswordResetContent,
    getRoleAssignmentContent,
    getFirstLoginOTPContent,
    getDepartmentDeletionNoticeContent,
    getRoleRemovedNoticeContent,
    getRoleChangedEmailContent,
    getInventoryRequestNotificationContent,
    getInventoryShareNotificationContent,
    getInventoryReturnNotificationContent,
    getIssueRaisedContent
} = require('../templates/emailTemplates');

class EmailService {
    constructor() {
        console.log('Initializing email service with SMTP configuration:');
        console.log({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS ? '[REDACTED]' : 'MISSING'
            }
        });
        
        if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error('WARNING: Missing SMTP configuration. Email service will not work properly!');
        }
        
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        // Verify connection configuration
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('SMTP connection verification failed:', error);
            } else {
                console.log('SMTP server is ready to take messages');
            }
        });
    }

    async sendEmail(to, subject, content) {
        try {
            console.log(`Attempting to send email to ${to} with subject "${subject}"`);
            console.log(`SMTP Config: Host=${process.env.SMTP_HOST}, Port=${process.env.SMTP_PORT}, Secure=${process.env.SMTP_SECURE}`);
            
            const mailOptions = {
                from: `"City Synergy" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html: getBaseTemplate(content)
            };

            console.log(`Mail options prepared. Sending from ${process.env.SMTP_USER} to ${to}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            console.error('Email error details:', {
                code: error.code,
                command: error.command,
                response: error.response,
                responseCode: error.responseCode,
                stack: error.stack
            });
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

    async sendPasswordResetEmail(user, tempPassword) {
        const subject = 'City Synergy - Password Reset Request';
        const content = getPasswordResetContent(user.email, tempPassword);
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

    async sendPasswordResetOTP(email, otp) {
        const subject = 'City Synergy - Password Reset Verification';
        const content = getPasswordResetContent(email, otp);
        return this.sendEmail(email, subject, content);
    }

    async sendDepartmentDeletionNotice(user, departmentName) {
        const subject = 'Important: Department Deletion Notice - City Synergy';
        const content = getDepartmentDeletionNoticeContent(user.email, departmentName);
        return this.sendEmail(user.email, subject, content);
    }

    async sendRoleRemovedNotice(user) {
        const subject = 'Important: Role Access Revoked - City Synergy';
        const content = getRoleRemovedNoticeContent(user.email);
        return this.sendEmail(user.email, subject, content);
    }

    /**
     * Send email notification to a user when their role has been deleted and they've been assigned a new role
     * @param {Object} user - User object with uuid, email, and username
     * @param {String} oldRoleName - Name of the deleted role
     * @param {String} newRoleName - Name of the newly assigned role
     * @param {Object} department - Department object with deptName
     * @returns {Promise} - Email sending promise
     */
    async sendRoleChangedEmail(user, oldRoleName, newRoleName, department) {
        const subject = `Role Change Notification - ${department.deptName} Department`;
        const content = getRoleChangedEmailContent(user.username, oldRoleName, newRoleName, department.deptName);
        return this.sendEmail(user.email, subject, content);
    }

    async sendInventoryRequestNotification(user, itemName, quantity, status, departmentName) {
        const subject = `Inventory Request ${status.toUpperCase()} - City Synergy`;
        const content = getInventoryRequestNotificationContent(itemName, quantity, status, departmentName);
        return this.sendEmail(user.email, subject, content);
    }

    async sendInventoryShareNotification(user, itemName, quantity, departmentName) {
        const subject = 'New Inventory Share - City Synergy';
        const content = getInventoryShareNotificationContent(itemName, quantity, departmentName);
        return this.sendEmail(user.email, subject, content);
    }

    async sendInventoryReturnNotification(user, itemName, quantity, departmentName) {
        const subject = 'Inventory Return Notification - City Synergy';
        const content = getInventoryReturnNotificationContent(itemName, quantity, departmentName);
        return this.sendEmail(user.email, subject, content);
    }

    async sendIssueRaisedNotification(issueDetails) {
        const subject = 'Issue Raised Notification - City Synergy';
        const content = getIssueRaisedContent(issueDetails); // ✅ Correct function call
        return this.sendEmail(issueDetails.raisedByEmailID, subject, content); // ✅ Correct 
    }
}

module.exports = new EmailService();
