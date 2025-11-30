import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../domain/services/user.service';
import { CommunityService } from '../domain/services/community.service';
import { WalletService } from '../domain/services/wallet.service';
import { Logger } from '@nestjs/common';

/**
 * Migration script to add all existing users to base communities
 * ("Образ Будущего" and "Марафон Добра")
 * 
 * Run with: npm run migration:add-users-to-base-communities
 */
async function migrateUsersToBaseCommunities() {
    const logger = new Logger('MigrateUsersToBaseCommunities');

    logger.log('Starting migration: Add users to base communities');

    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const userService = app.get(UserService);
        const communityService = app.get(CommunityService);
        const walletService = app.get(WalletService);

        // Get all users
        logger.log('Fetching all users...');
        const users = await userService.getAllUsers();
        logger.log(`Found ${users.length} users`);

        // Get base communities
        const futureVision = await communityService.getCommunityByTypeTag('future-vision');
        const marathonOfGood = await communityService.getCommunityByTypeTag('marathon-of-good');

        if (!futureVision) {
            logger.error('Future Vision community not found!');
            return;
        }

        if (!marathonOfGood) {
            logger.error('Marathon of Good community not found!');
            return;
        }

        logger.log(`Base communities found:`);
        logger.log(`- Future Vision: ${futureVision.id}`);
        logger.log(`- Marathon of Good: ${marathonOfGood.id}`);

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                logger.log(`Processing user: ${user.id} (${user.displayName || user.username})`);

                // Use the existing ensureUserInBaseCommunities method
                await userService.ensureUserInBaseCommunities(user.id);

                processedCount++;
                logger.log(`✓ User ${user.id} processed successfully`);
            } catch (error) {
                errorCount++;
                logger.error(`✗ Error processing user ${user.id}:`, error.message);
            }
        }

        logger.log('\n=== Migration Summary ===');
        logger.log(`Total users: ${users.length}`);
        logger.log(`Processed: ${processedCount}`);
        logger.log(`Skipped: ${skippedCount}`);
        logger.log(`Errors: ${errorCount}`);
        logger.log('=========================\n');

        logger.log('Migration completed successfully!');
    } catch (error) {
        logger.error('Migration failed:', error);
        throw error;
    } finally {
        await app.close();
    }
}

// Run migration
migrateUsersToBaseCommunities()
    .then(() => {
        console.log('Migration script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
