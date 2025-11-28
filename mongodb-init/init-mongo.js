// MongoDB initialization script for authentication setup
// This script creates an application user for MongoDB
// Admin user is created automatically by MongoDB using MONGO_INITDB_ROOT_USERNAME and MONGO_INITDB_ROOT_PASSWORD

// Read application user password from file (set via MONGO_APP_PASSWORD_FILE)
// Fallback to environment variable or default
const fs = require('fs');
let appPassword = 'CHANGE_ME_APP_PASSWORD';

if (process.env.MONGO_APP_PASSWORD_FILE) {
  try {
    appPassword = fs.readFileSync(process.env.MONGO_APP_PASSWORD_FILE, 'utf8').trim();
  } catch (e) {
    print('Warning: Could not read MONGO_APP_PASSWORD_FILE, using default');
  }
} else if (process.env.MONGO_APP_PASSWORD) {
  appPassword = process.env.MONGO_APP_PASSWORD;
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

