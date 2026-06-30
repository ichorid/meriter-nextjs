// Idempotent application user ensure — runs after replica set PRIMARY via mongodb-rs-init.
// Same logic as init-mongo.js (first-boot initdb.d). Recovers volumes where initdb failed.

let appPassword = 'CHANGE_ME_APP_PASSWORD';

if (process.env.MONGO_APP_PASSWORD) {
  appPassword = process.env.MONGO_APP_PASSWORD;
} else {
  print('ensure-app-user: MONGO_APP_PASSWORD not set, skipping user creation');
  quit(0);
}

db = db.getSiblingDB('meriter');

try {
  db.createUser({
    user: 'meriter_user',
    pwd: appPassword,
    roles: [{ role: 'readWrite', db: 'meriter' }],
  });
  print('ensure-app-user: application user created');
} catch (e) {
  if (e.code === 51003) {
    print('ensure-app-user: application user already exists');
  } else {
    throw e;
  }
}
