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

const getPasswordResetContent = (email, resetLink) => `
    <div class="header">
        <h2>Password Reset Request</h2>
    </div>
    <div class="content">
        <p>Hello,</p>
        <p>We received a request to reset your password for your City Synergy account.</p>
        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
        <a href="${resetLink}" class="button">Reset Password</a>
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

module.exports = {
    getBaseTemplate,
    getWelcomeDevUserContent,
    getWelcomeDeptUserContent,
    getDepartmentHeadContent,
    getPasswordResetContent,
    getRoleAssignmentContent
}; 