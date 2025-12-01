import { NestFactory } from '@nestjs/core';
import { MeriterModule } from '../meriter.module';
import { CommunityService } from '../domain/services/community.service';
import { Logger } from '@nestjs/common';

/**
 * Migration script to set priority flag for base communities
 * ("Образ Будущего" and "Марафон Добра")
 *
 * Run with: npm run migration:set-priority-communities
 */
async function setPriorityCommunities() {
  const logger = new Logger('SetPriorityCommunities');

  logger.log('Starting migration: Set priority for base communities');

  const app = await NestFactory.createApplicationContext(MeriterModule);

  try {
    const communityService = app.get(CommunityService);

    // Get base communities by typeTag
    const futureVision =
      await communityService.getCommunityByTypeTag('future-vision');
    const marathonOfGood =
      await communityService.getCommunityByTypeTag('marathon-of-good');

    if (!futureVision) {
      logger.warn('Community "Образ Будущего" (future-vision) not found');
    } else {
      logger.log(`Found "Образ Будущего" community: ${futureVision.id}`);
      await communityService.updateCommunity(futureVision.id, {
        isPriority: true,
      } as any);
      logger.log(`Set priority for "Образ Будущего" community`);
    }

    if (!marathonOfGood) {
      logger.warn('Community "Марафон Добра" (marathon-of-good) not found');
    } else {
      logger.log(`Found "Марафон Добра" community: ${marathonOfGood.id}`);
      await communityService.updateCommunity(marathonOfGood.id, {
        isPriority: true,
      } as any);
      logger.log(`Set priority for "Марафон Добра" community`);
    }

    logger.log('Migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

setPriorityCommunities();
