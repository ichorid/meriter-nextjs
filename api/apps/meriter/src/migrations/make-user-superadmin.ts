import mongoose from 'mongoose';

/**
 * Standalone script to make a user a superadmin by email
 * 
 * Run with: npx ts-node apps/meriter/src/migrations/make-user-superadmin.ts <email>
 */
async function makeUserSuperadmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address as an argument');
        process.exit(1);
    }

    console.log(`Starting script: Make user ${email} superadmin`);

    // Default local connection string
    const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/meriter';
    console.log(`Connecting to MongoDB at ${uri}...`);

    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.db.collection('users');

        let user;
        if (email.includes('@')) {
            console.log(`Searching for user with email: ${email}`);
            user = await collection.findOne({ 'profile.contacts.email': email });
        } else {
            console.log(`Searching for user with ID: ${email}`);
            user = await collection.findOne({ id: email });
        }

        if (!user) {
            console.error(`User with identifier ${email} not found!`);

            console.log('Listing all users:');
            const users = await collection.find({}).toArray();
            users.forEach(u => {
                console.log(`- ID: ${u.id}`);
                console.log(`  Name: ${u.displayName}`);
                console.log(`  Auth: ${u.authProvider} / ${u.authId}`);
                console.log(`  Profile:`, u.profile);
            });

            await mongoose.disconnect();
            return;
        }

        console.log(`Found user: ${user.id} (${user.displayName || user.username})`);
        console.log(`Current global role: ${user.globalRole || 'none'}`);

        if (user.globalRole === 'superadmin') {
            console.log('User is already a superadmin');
            await mongoose.disconnect();
            return;
        }

        // Update user role
        const result = await collection.updateOne(
            { _id: user._id },
            { $set: { globalRole: 'superadmin' } }
        );

        console.log(`Successfully updated user ${user.id} to superadmin`);
        console.log(`Modified count: ${result.modifiedCount}`);

    } catch (error) {
        console.error('Script failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run script
makeUserSuperadmin()
    .then(() => {
        console.log('Script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
