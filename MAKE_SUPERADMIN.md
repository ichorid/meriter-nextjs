# How to Make Yourself a Superadmin

This guide explains how to grant yourself the `superadmin` role directly through MongoDB, bypassing the invite system.

## Overview

The app uses a `globalRole` field on the User model. When set to `'superadmin'`, you get superadmin privileges across all communities. This is checked first before any community-specific roles.

## Prerequisites

- Access to MongoDB (via Docker container or connection string)
- Know how to identify your user account (see methods below)

## Step 1: Identify Your User

First, you need to find your user document in MongoDB. Users are stored in the `users` collection in the `meriter` database.

You can identify your user by:

### Method 1: By Username (Recommended - Easiest)
```javascript
// In MongoDB shell or MongoDB Compass
db.users.findOne({
  username: "YOUR_USERNAME"  // Replace with your username
})
```

### Method 2: By OAuth Provider and ID
The system supports multiple OAuth providers: `google`, `yandex`, `vk`, `telegram`, `apple`, `twitter`, `instagram`, `sber`.

```javascript
db.users.findOne({
  authProvider: "google",  // or "yandex", "vk", "telegram", "apple", "twitter", "instagram", "sber"
  authId: "YOUR_PROVIDER_ID"  // Replace with your provider-specific user ID
})
```

### Method 3: By Display Name
```javascript
db.users.findOne({
  displayName: "YOUR_DISPLAY_NAME"  // Replace with your display name
})
```

### Method 4: By User ID
```javascript
db.users.findOne({
  id: "YOUR_USER_ID"  // Replace with your internal user ID
})
```

### Method 5: List All Users
If you're not sure, you can list all users:
```javascript
db.users.find({}, { displayName: 1, username: 1, authProvider: 1, authId: 1, id: 1 }).pretty()
```

## Step 2: Update Your User Document

Once you've identified your user document, update it to add the `globalRole: 'superadmin'` field:

### Option A: Using Docker Container (Recommended - One-liner)

**By Username:**
```bash
docker exec -it meriter-mongodb mongosh meriter --eval 'db.users.updateOne({username: "YOUR_USERNAME"}, {$set: {globalRole: "superadmin", updatedAt: new Date()}})'
```

**By OAuth Provider and ID:**
```bash
docker exec -it meriter-mongodb mongosh meriter --eval 'db.users.updateOne({authProvider: "google", authId: "YOUR_PROVIDER_ID"}, {$set: {globalRole: "superadmin", updatedAt: new Date()}})'
```

**By User ID:**
```bash
docker exec -it meriter-mongodb mongosh meriter --eval 'db.users.updateOne({id: "YOUR_USER_ID"}, {$set: {globalRole: "superadmin", updatedAt: new Date()}})'
```

If authentication is required (production setup), use:
```bash
docker exec -it meriter-mongodb mongosh meriter -u meriter_user -p "$MONGO_APP_PASSWORD" --authenticationDatabase meriter --eval 'db.users.updateOne({username: "YOUR_USERNAME"}, {$set: {globalRole: "superadmin", updatedAt: new Date()}})'
```

### Option B: Using MongoDB Shell (Interactive)

Connect to the container and run MongoDB shell:
```bash
docker exec -it meriter-mongodb mongosh meriter
```

Then run:
```javascript
// Replace the filter with one of the methods from Step 1
db.users.updateOne(
  {
    username: "YOUR_USERNAME"  // or use authProvider/authId, id, or displayName
  },
  {
    $set: {
      globalRole: "superadmin",
      updatedAt: new Date()
    }
  }
)
```

### Option C: Using MongoDB Compass

1. Connect to your MongoDB instance (use connection string or connect via Docker network)
2. Navigate to the `meriter` database
3. Open the `users` collection
4. Find your user document using one of the filters from Step 1
5. Click "Edit Document"
6. Add or update the `globalRole` field to `"superadmin"`
7. Save the document

### Option D: Using MongoDB Connection String (Command Line)

If connecting from outside the container:
```bash
mongosh "mongodb://127.0.0.1:27017/meriter" --eval 'db.users.updateOne({username: "YOUR_USERNAME"}, {$set: {globalRole: "superadmin", updatedAt: new Date()}})'
```

Or with authentication:
```bash
mongosh "mongodb://meriter_user:YOUR_PASSWORD@127.0.0.1:27017/meriter?authSource=meriter" --eval 'db.users.updateOne({username: "YOUR_USERNAME"}, {$set: {globalRole: "superadmin", updatedAt: new Date()}})'
```

## Step 3: Verify the Update

Verify that the update was successful:

**Using Docker Container (One-liner):**
```bash
docker exec -it meriter-mongodb mongosh meriter --eval 'db.users.findOne({username: "YOUR_USERNAME"}, {displayName: 1, globalRole: 1, id: 1, username: 1})'
```

**Using MongoDB Shell:**
```javascript
db.users.findOne(
  {
    username: "YOUR_USERNAME"  // or use the same filter you used for update
  },
  {
    displayName: 1,
    globalRole: 1,
    id: 1,
    username: 1
  }
)
```

You should see `globalRole: "superadmin"` in the output.

## Step 4: Restart Your Session

After making the change:

1. **Log out** of the application (if you're currently logged in) - This is critical!
2. **Clear your browser cookies** (optional but recommended) - You can also just clear cookies for the site
3. **Log back in** - your JWT token will be refreshed with the new role
4. You should now have superadmin privileges and no longer be asked for an invite code

**Important**: The backend now properly returns the `globalRole` field in the `/me` endpoint. If you're using an older version of the code, you may need to update it first (see the code change in `api/apps/meriter/src/api-v1/common/utils/jwt-service.util.ts`).

## What Superadmin Allows

According to the codebase, superadmin role grants you:

- ✅ Always able to create publications (regardless of community rules)
- ✅ Always able to vote on publications
- ✅ Always able to comment
- ✅ Always able to see all communities (regardless of visibility rules)
- ✅ Always able to edit/delete any publication or comment
- ✅ Ability to create `superadmin-to-lead` invites
- ✅ Ability to update user community roles
- ✅ Full access to all team management features

## Troubleshooting

### The update didn't work

1. **Check your MongoDB connection**: Make sure you're connected to the correct database (`meriter`)
2. **Verify the user document**: Double-check that you updated the correct user document
3. **Check field name**: The field must be exactly `globalRole` (not `role` or `global_role`)
4. **Check value**: The value must be exactly `"superadmin"` (string, lowercase)

### Still don't have superadmin privileges after logging in

1. **Clear your browser cookies/localStorage**: Your old JWT token might be cached
2. **Check server logs**: Look for any errors when verifying your JWT token
3. **Verify the MongoDB update**: Run the verification query again to confirm the field was set

### Can't find my user document

1. **Check if you've logged in**: You need to have created an account first by logging in through one of the OAuth providers
2. **Check database name**: Make sure you're looking in the `meriter` database (not `meriter_test`)
3. **Check authentication provider**: Make sure you're searching with the correct `authProvider` value (e.g., `"google"`, `"yandex"`, `"vk"`, `"telegram"`, `"apple"`, `"twitter"`, `"instagram"`, `"sber"`)
4. **Check username**: Username is optional and may not be set for all users. Try using `authProvider` and `authId` instead

## Security Note

⚠️ **Important**: This method bypasses the normal invite system. Only use this for:
- Initial setup of the first superadmin
- Development/testing environments
- Recovery scenarios

In production, consider using the proper invite system once you have your first superadmin set up.

## Alternative: Using the Invite System

Once you have one superadmin, they can create invites for other superadmins using the `superadmin-to-lead` invite type (though this creates leads, not superadmins - superadmin is a global role that must be set directly).

To create additional superadmins after the first one:
1. The existing superadmin must use MongoDB to set `globalRole: "superadmin"` for other users
2. Or automate this through an admin script/endpoint

