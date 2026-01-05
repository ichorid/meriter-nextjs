// Script to add test users and make them leads in communities
// Usage: docker exec meriter-mongodb mongosh meriter < add-test-leads.mjs
//    or: mongosh meriter < add-test-leads.mjs

// Generate a simple ID (similar to uid() function used in the codebase)
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Get existing communities
const communities = db.communities.find({}, { id: 1, name: 1, typeTag: 1 }).toArray();
print(`Found ${communities.length} communities`);

if (communities.length === 0) {
  print('No communities found. Cannot assign leads.');
  quit(1);
}

// Display communities
print('\nAvailable communities:');
communities.forEach((c, i) => {
  print(`${i + 1}. ${c.name} (ID: ${c.id}, Type: ${c.typeTag || 'regular'})`);
});

// Create test users with lead roles
const testUsers = [
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    displayName: 'Alice Johnson',
    username: 'alice_johnson',
  },
  {
    firstName: 'Bob',
    lastName: 'Smith',
    displayName: 'Bob Smith',
    username: 'bob_smith',
  },
  {
    firstName: 'Charlie',
    lastName: 'Brown',
    displayName: 'Charlie Brown',
    username: 'charlie_brown',
  },
];

const now = new Date();
const createdUsers = [];
const createdRoles = [];

print('\nCreating test users...');

for (const userData of testUsers) {
  const userId = generateId();
  const authId = `test_lead_${userData.username}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const user = {
    id: userId,
    authProvider: 'test',
    authId: authId,
    username: userData.username,
    firstName: userData.firstName,
    lastName: userData.lastName,
    displayName: userData.displayName,
    avatarUrl: null,
    profile: {
      bio: null,
      location: {
        region: null,
        city: null,
      },
      website: null,
      isVerified: false,
      about: null,
      contacts: {
        email: null,
        messenger: null,
      },
      educationalInstitution: null,
    },
    globalRole: null,
    meritStats: {},
    inviteCode: null,
    communityTags: [],
    communityMemberships: [],
    authenticators: [],
    createdAt: now,
    updatedAt: now,
  };
  
  try {
    db.users.insertOne(user);
    createdUsers.push({ id: userId, name: userData.displayName });
    print(`✓ Created user: ${userData.displayName} (ID: ${userId})`);
  } catch (e) {
    if (e.code === 11000) {
      print(`⚠ User ${userData.username} already exists, skipping...`);
    } else {
      print(`✗ Error creating user ${userData.displayName}: ${e.message}`);
    }
  }
}

print('\nAssigning lead roles to users...');

// Assign each user as a lead to different communities
// Try to distribute them across different communities
for (let i = 0; i < createdUsers.length && i < communities.length; i++) {
  const user = createdUsers[i];
  const community = communities[i];
  const roleId = generateId();
  
  const role = {
    id: roleId,
    userId: user.id,
    communityId: community.id,
    role: 'lead',
    createdAt: now,
    updatedAt: now,
  };
  
  try {
    db.user_community_roles.insertOne(role);
    createdRoles.push({ userId: user.id, userName: user.name, communityId: community.id, communityName: community.name });
    print(`✓ Made ${user.name} a lead in "${community.name}"`);
  } catch (e) {
    if (e.code === 11000) {
      print(`⚠ Role already exists for ${user.name} in ${community.name}, skipping...`);
    } else {
      print(`✗ Error assigning role: ${e.message}`);
    }
  }
}

print('\n=== Summary ===');
print(`Created ${createdUsers.length} users:`);
createdUsers.forEach(u => print(`  - ${u.name} (${u.id})`));

print(`\nCreated ${createdRoles.length} lead roles:`);
createdRoles.forEach(r => print(`  - ${r.userName} is lead in "${r.communityName}"`));

print('\nDone!');

