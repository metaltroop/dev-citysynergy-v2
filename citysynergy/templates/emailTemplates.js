const getBaseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            font-family: Arial, sans-serif;
        }
        .header {
            background-color: #003366;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #ffffff;
            padding: 20px;
            border: 1px solid #dddddd;
        }
        .footer {
            background-color: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            border-radius: 0 0 5px 5px;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;

const getWelcomeDevUserContent = (email, tempPassword) => `
    <div class="header">
        <h2>Welcome to City Synergy</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>Your developer account has been created in the City Synergy system.</p>
        <p>Your login credentials:</p>
        <ul>
            <li>Email: ${email}</li>
            <li>Temporary Password: ${tempPassword}</li>
        </ul>
        <p>Please change your password upon first login.</p>
        <a href="${process.env.FRONTEND_URL}/login" class="button">Login to City Synergy</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getWelcomeDeptUserContent = (email, tempPassword, department) => `
    <div class="header">
        <h2>Welcome to City Synergy</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>Your account has been created in the City Synergy system for the ${department.deptName} department.</p>
        <p>Your login credentials:</p>
        <ul>
            <li>Email: ${email}</li>
            <li>Temporary Password: ${tempPassword}</li>
            <li>Department: ${department.deptName} (${department.deptCode})</li>
        </ul>
        <p>Please change your password upon first login.</p>
        <a href="${process.env.FRONTEND_URL}/login" class="button">Login to City Synergy</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getDepartmentHeadContent = (email, tempPassword, department) => `
    <div class="header">
        <h2>Department Head Account Created</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>You have been assigned as the Department Head for ${department.deptName}.</p>
        <p>Your login credentials:</p>
        <ul>
            <li>Email: ${email}</li>
            <li>Temporary Password: ${tempPassword}</li>
            <li>Department: ${department.deptName} (${department.deptCode})</li>
        </ul>
        <p>As Department Head, you have full access to manage your department's resources and users.</p>
        <p>Please change your password upon first login.</p>
        <a href="${process.env.FRONTEND_URL}/login" class="button">Login to City Synergy</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getPasswordResetContent = (email, tempPassword) => `
    <div class="header">
        <h2>Password Reset Request</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>We received a request to reset your password for your City Synergy account.</p>
        <p>Your login credentials:</p>
        <ul>
            <li>Email: ${email}</li>
            <li>Temporary Password: ${tempPassword}</li>
        </ul>
        <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getRoleAssignmentContent = (email, roles, department = null) => `
    <div class="header">
        <h2>Role Assignment Update</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>Your roles have been updated in the City Synergy system.</p>
        ${department ? `<p>Department: ${department.deptName}</p>` : ''}
        <p>Your assigned roles:</p>
        <ul>
            ${roles.map(role => `<li>${role.roleName}</li>`).join('')}
        </ul>
        <a href="${process.env.FRONTEND_URL}/profile" class="button">View Your Profile</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getFirstLoginOTPContent = (email, otp) => `
    <div class="header">
        <h2>First Login Verification</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>To complete your first login and set up your account, please use the following OTP:</p>
        <div style="text-align: center; padding: 20px; background: #f5f5f5; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #003366; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please contact your system administrator.</p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getPasswordResetOTP = (email, otp) => `
    <div class="header">
        <h2>Password Reset Verification</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>To reset your password, please use the following OTP:</p>
        <div style="text-align: center; padding: 20px; background: #f5f5f5; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #003366; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please contact your system administrator.</p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getDepartmentDeletionNoticeContent = (email, departmentName) => `
    <div class="header">
        <h2>Department Deletion Notice</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>This is to inform you that the department "${departmentName}" has been deleted from the City Synergy system.</p>
        <p>As a result:</p>
        <ul>
            <li>Your access to the system has been revoked</li>
            <li>Your account has been removed</li>
            <li>All your associated department roles have been removed</li>
        </ul>
        <p>Please contact your administrator for further updates.</p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getRoleRemovedNoticeContent = (email) => `
    <div class="header">
        <h2>Role Access Revoked</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>This is to inform you that your role(s) in the City Synergy system have been removed.</p>
        <p>As a result:</p>
        <ul>
            <li>Your access to the system has been temporarily suspended</li>
            <li>Your password has been reset</li>
            <li>You will not be able to login until new role(s) are assigned</li>
        </ul>
        <p>Once you are assigned new role(s), you will receive a new temporary password.</p>
        <p>Please contact your administrator for further updates.</p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getRoleChangedEmailContent = (username, oldRoleName, newRoleName, departmentName) => `
    <div class="header">
        <h2>Role Change Notification</h2>
    </div>
    <div class="content">
        <p>Hello ${username},</p>
        
        <p>This is to inform you that your role in the <strong>${departmentName}</strong> department has been updated:</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Previous Role:</strong> ${oldRoleName}</p>
            <p><strong>New Role:</strong> ${newRoleName}</p>
        </div>
        
        <p>Your previous role has been removed from the system, and you have been temporarily assigned to the ${newRoleName} role.</p>
        
        <p>If you believe this change was made in error or have questions about your new permissions, please contact your department administrator.</p>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getInventoryRequestNotificationContent = (itemName, quantity, status, departmentName) => `
    <div class="header">
        <h2>Inventory Request ${status.toUpperCase()}</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>Your request for inventory items has been ${status}.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Item:</strong> ${itemName}</p>
            <p><strong>Quantity:</strong> ${quantity}</p>
            <p><strong>Department:</strong> ${departmentName}</p>
            <p><strong>Status:</strong> ${status.toUpperCase()}</p>
        </div>
        <p>You can view the details of this request in your inventory dashboard.</p>
        <a href="${process.env.FRONTEND_URL}/inventory/requests" class="button">View Request Details</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getInventoryShareNotificationContent = (itemName, quantity, departmentName) => `
    <div class="header">
        <h2>New Inventory Share</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>A new inventory item has been shared with your department.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Item:</strong> ${itemName}</p>
            <p><strong>Quantity Available:</strong> ${quantity}</p>
            <p><strong>Sharing Department:</strong> ${departmentName}</p>
        </div>
        <p>You can view and request this item in your inventory dashboard.</p>
        <a href="${process.env.FRONTEND_URL}/inventory/sharing" class="button">View Shared Items</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

const getInventoryReturnNotificationContent = (itemName, quantity, departmentName) => `
    <div class="header">
        <h2>Inventory Return Notification</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>Items have been returned to your department.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Item:</strong> ${itemName}</p>
            <p><strong>Quantity Returned:</strong> ${quantity}</p>
            <p><strong>Returning Department:</strong> ${departmentName}</p>
        </div>
        <p>You can view the updated inventory in your dashboard.</p>
        <a href="${process.env.FRONTEND_URL}/inventory" class="button">View Inventory</a>
    </div>
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} City Synergy</p>
    </div>`;

    const getIssueRaisedContent = (issueDetails) => `
<div class="header">
    <h2>Issue Raised Successfully</h2>
</div>
<div class="content">
    <p>Hello ${issueDetails.raisedByName},</p>
    <p>Your issue has been successfully raised in the system.</p>
    <p><strong>Issue Details:</strong></p>
    <ul>
        <li><strong>Issue ID:</strong> ${issueDetails.IssueId}</li>
        <li><strong>Category:</strong> ${issueDetails.IssueCategory}</li>
        <li><strong>Name:</strong> ${issueDetails.IssueName}</li>
        <li><strong>Description:</strong> ${issueDetails.IssueDescription || 'N/A'}</li>
        <li><strong>Related Department:</strong> ${issueDetails.Related || 'N/A'}</li>
        <li><strong>Locality:</strong> ${issueDetails.locality}</li>
        <li><strong>Pincode:</strong> ${issueDetails.pincode}</li>
        <li><strong>Status:</strong> Raised ✅</li>
    </ul>
    <p>Thank you for raising this issue. Our team will review it shortly.</p>
</div>
<div class="footer">
    <p>&copy; ${new Date().getFullYear()} City Synergy</p>
</div>`;

module.exports = {
    getBaseTemplate,
    getWelcomeDevUserContent,
    getWelcomeDeptUserContent,
    getDepartmentHeadContent,
    getPasswordResetContent,
    getRoleAssignmentContent,
    getFirstLoginOTPContent,
    getPasswordResetOTP,
    getDepartmentDeletionNoticeContent,
    getRoleRemovedNoticeContent,
    getRoleChangedEmailContent,
    getInventoryRequestNotificationContent,
    getInventoryShareNotificationContent,
    getInventoryReturnNotificationContent,
    getIssueRaisedContent
};