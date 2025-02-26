#!/bin/bash

# Create project directory and navigate into it
mkdir -p citysynergy
cd citysynergy

# Create necessary directories
mkdir -p config models controllers routes middleware utils services database emails

# Initialize npm project
npm init -y

# Install required dependencies
npm install express sequelize mysql2 dotenv bcrypt jsonwebtoken nodemailer

# Create empty files with basic comments
# Config files
echo "// Configuration settings for the application" > config/config.js
echo "// Database connection configuration" > config/database.js

# Create empty model files with comments
echo "// User model definition" > models/common_users.js
echo "// Role model definition" > models/dev_roles.js
echo "// Feature model definition" > models/dev_features.js
echo "// Role-Feature mapping model" > models/dev_roleFeature.js
echo "// Department model definition" > models/common_dept.js
echo "// User-Role mapping model" > models/dev_user_role.js
echo "// Issues model definition" > models/common_Issues.js
echo "// Inventory model definition" > models/common_inventory.js
echo "// Inventory request model definition" > models/inventory_request.js
echo "// Tenders model definition" > models/tenders.js
echo "// Clashes model definition" > models/clashes.js

# Create basic controller and route files
echo "// Authentication controller" > controllers/authController.js
echo "// Department controller" > controllers/departmentController.js
echo "// User controller" > controllers/userController.js

echo "// Authentication routes" > routes/authRoutes.js
echo "// Department routes" > routes/departmentRoutes.js
echo "// User routes" > routes/userRoutes.js

# Create middleware files
echo "// Authentication middleware" > middleware/authMiddleware.js
echo "// Authorization middleware" > middleware/authorizeMiddleware.js

# Create utility and service files
echo "// Database initialization utilities" > utils/db_initializer.js
echo "// General utility functions" > utils/helpers.js

echo "// Email service" > services/emailService.js
echo "// User service" > services/userService.js

# Create database files
echo "// Database connection and initialization" > database/database.js

# Create main application file
echo "// Main application entry point" > index.js

# Create .env file with template values
cat > .env << EOL
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=citysynergydb
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
EOL

echo "Project structure created successfully!" 