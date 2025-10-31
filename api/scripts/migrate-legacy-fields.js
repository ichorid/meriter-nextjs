#!/usr/bin/env node
/**
 * Database Migration Script for Legacy Fields
 * 
 * This script migrates legacy field names and removes legacy indexes.
 * Run this in a MongoDB shell or use mongosh:
 * 
 * mongosh "mongodb://localhost:27017/meriter" --file scripts/migrate-legacy-fields.js
 * 
 * Or run interactively:
 * mongosh "mongodb://localhost:27017/meriter"
 * Then paste the contents of this file
 */

// ============================================================================
// LEGACY INDEXES TO REMOVE
// ============================================================================

print('📋 Checking for legacy indexes...');

// User collection indexes
try {
  const userIndexes = db.users.getIndexes();
  const legacyUserIndexes = userIndexes.filter(idx => 
    idx.name === 'token_1' || idx.name === 'tags_1'
  );
  
  if (legacyUserIndexes.length > 0) {
    print(`Found ${legacyUserIndexes.length} legacy indexes in users collection`);
    legacyUserIndexes.forEach(idx => {
      print(`  - Dropping index: ${idx.name}`);
      db.users.dropIndex(idx.name);
    });
  } else {
    print('✓ No legacy indexes found in users collection');
  }
} catch (e) {
  print(`⚠️  Error checking user indexes: ${e.message}`);
}

// Vote collection indexes
try {
  const voteIndexes = db.votes.getIndexes();
  const legacyVoteIndexes = voteIndexes.filter(idx => 
    idx.name === 'commentId_1'
  );
  
  if (legacyVoteIndexes.length > 0) {
    print(`Found ${legacyVoteIndexes.length} legacy indexes in votes collection`);
    legacyVoteIndexes.forEach(idx => {
      print(`  - Dropping index: ${idx.name}`);
      db.votes.dropIndex(idx.name);
    });
  } else {
    print('✓ No legacy indexes found in votes collection');
  }
} catch (e) {
  print(`⚠️  Error checking vote indexes: ${e.message}`);
}

// Poll Cast collection indexes
try {
  const pollCastIndexes = db.poll_casts.getIndexes();
  const legacyPollCastIndexes = pollCastIndexes.filter(idx => 
    idx.name === 'optionIndex_1'
  );
  
  if (legacyPollCastIndexes.length > 0) {
    print(`Found ${legacyPollCastIndexes.length} legacy indexes in poll_casts collection`);
    legacyPollCastIndexes.forEach(idx => {
      print(`  - Dropping index: ${idx.name}`);
      db.poll_casts.dropIndex(idx.name);
    });
  } else {
    print('✓ No legacy indexes found in poll_casts collection');
  }
} catch (e) {
  print(`⚠️  Error checking poll_casts indexes: ${e.message}`);
}

// ============================================================================
// DATA MIGRATIONS
// ============================================================================

print('\n📊 Migrating legacy field values...');

// Migrate users.tags -> users.communityTags
try {
  const usersWithTags = db.users.countDocuments({ tags: { $exists: true } });
  if (usersWithTags > 0) {
    print(`Found ${usersWithTags} users with legacy 'tags' field`);
    const result = db.users.updateMany(
      { tags: { $exists: true } },
      [
        {
          $set: {
            communityTags: { $ifNull: ['$tags', []] },
            tags: '$$REMOVE'
          }
        }
      ]
    );
    print(`  ✓ Migrated ${result.modifiedCount} users: tags -> communityTags`);
  } else {
    print('✓ No users with legacy tags field found');
  }
} catch (e) {
  print(`⚠️  Error migrating user tags: ${e.message}`);
}

// Migrate votes.sourceType: 'daily_quota' -> 'quota'
try {
  const votesWithDailyQuota = db.votes.countDocuments({ sourceType: 'daily_quota' });
  if (votesWithDailyQuota > 0) {
    print(`Found ${votesWithDailyQuota} votes with legacy 'daily_quota' sourceType`);
    const result = db.votes.updateMany(
      { sourceType: 'daily_quota' },
      { $set: { sourceType: 'quota' } }
    );
    print(`  ✓ Migrated ${result.modifiedCount} votes: daily_quota -> quota`);
  } else {
    print('✓ No votes with legacy daily_quota sourceType found');
  }
} catch (e) {
  print(`⚠️  Error migrating vote sourceType: ${e.message}`);
}

// Migrate votes.commentId -> votes.attachedCommentId (if exists)
try {
  const votesWithCommentId = db.votes.countDocuments({ commentId: { $exists: true } });
  if (votesWithCommentId > 0) {
    print(`Found ${votesWithCommentId} votes with legacy 'commentId' field`);
    const result = db.votes.updateMany(
      { commentId: { $exists: true }, attachedCommentId: { $exists: false } },
      [
        {
          $set: {
            attachedCommentId: '$commentId',
            commentId: '$$REMOVE'
          }
        }
      ]
    );
    print(`  ✓ Migrated ${result.modifiedCount} votes: commentId -> attachedCommentId`);
  } else {
    print('✓ No votes with legacy commentId field found');
  }
} catch (e) {
  print(`⚠️  Error migrating vote commentId: ${e.message}`);
}

// Migrate poll_casts.optionIndex -> poll_casts.optionId (if exists)
try {
  const castsWithOptionIndex = db.poll_casts.countDocuments({ optionIndex: { $exists: true } });
  if (castsWithOptionIndex > 0) {
    print(`Found ${castsWithOptionIndex} poll casts with legacy 'optionIndex' field`);
    // Note: This migration requires mapping optionIndex to optionId based on poll options
    // This is complex and may require manual verification
    print(`  ⚠️  Manual migration required for optionIndex -> optionId`);
    print(`  ⚠️  Please verify poll options and update manually`);
  } else {
    print('✓ No poll casts with legacy optionIndex field found');
  }
} catch (e) {
  print(`⚠️  Error checking poll_casts optionIndex: ${e.message}`);
}

// Remove token field from users (if exists)
try {
  const usersWithToken = db.users.countDocuments({ token: { $exists: true } });
  if (usersWithToken > 0) {
    print(`Found ${usersWithToken} users with legacy 'token' field`);
    const result = db.users.updateMany(
      { token: { $exists: true } },
      { $unset: { token: '' } }
    );
    print(`  ✓ Removed token field from ${result.modifiedCount} users`);
  } else {
    print('✓ No users with legacy token field found');
  }
} catch (e) {
  print(`⚠️  Error removing token field: ${e.message}`);
}

print('\n✅ Migration complete!');
print('\n📝 Summary:');
print('  - Legacy indexes removed');
print('  - Field migrations completed');
print('  - Token fields removed');
print('\n⚠️  Note: Some migrations may require manual verification.');

