// MongoDB initialization script for authentication setup
// This script creates an application user for MongoDB
// Admin user is created automatically by MongoDB using MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD

// Read application user password from environment variable
// Set via MONGO_APP_PASSWORD in docker-compose.yml (from .env file)
let appPassword = 'CHANGE_ME_APP_PASSWORD';

if (process.env.MONGO_APP_PASSWORD) {
  appPassword = process.env.MONGO_APP_PASSWORD;
} else {
  print('Warning: MONGO_APP_PASSWORD not set, using default password. This should be changed!');
}

// Switch to application database
db = db.getSiblingDB('meriter');

// Create application user (if it doesn't exist)
try {
  db.createUser({
    user: 'meriter_user',
    pwd: appPassword,
    roles: [
      { role: 'readWrite', db: 'meriter' }
    ]
  });
  print('Application user created successfully');
} catch (e) {
  if (e.code === 51003) {
    print('Application user already exists');
  } else {
    throw e;
  }
}

print('MongoDB initialization completed');

