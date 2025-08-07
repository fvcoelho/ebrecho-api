#!/usr/bin/env node

/**
 * User Role Management Script
 * 
 * This script helps check and update user roles in the eBrecho database.
 * It can be used to diagnose role-related authentication issues.
 * 
 * Usage:
 *   node scripts/user-role-manager.js list                    # List all users with their roles
 *   node scripts/user-role-manager.js check <email>          # Check specific user's role
 *   node scripts/user-role-manager.js update <email> <role>  # Update user's role
 *   node scripts/user-role-manager.js stats                  # Show role distribution
 * 
 * Available roles: ADMIN, PARTNER_ADMIN, PARTNER_USER, PROMOTER, PARTNER_PROMOTER, CUSTOMER
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const VALID_ROLES = ['ADMIN', 'PARTNER_ADMIN', 'PARTNER_USER', 'PROMOTER', 'PARTNER_PROMOTER', 'CUSTOMER'];

async function listUsers() {
  console.log('📋 All Users with Roles:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      promoter: {
        select: {
          id: true,
          isActive: true,
          tier: true
        }
      }
    },
    orderBy: [
      { role: 'asc' },
      { email: 'asc' }
    ]
  });

  users.forEach(user => {
    const status = [];
    if (!user.isActive) status.push('INACTIVE');
    if (!user.emailVerified) status.push('UNVERIFIED');
    if (user.promoter) status.push(`PROMOTER_TIER:${user.promoter.tier}`);
    if (user.promoter && !user.promoter.isActive) status.push('PROMOTER_INACTIVE');
    
    const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : '';
    
    console.log(`${user.role.padEnd(15)} | ${user.email.padEnd(30)} | ${user.name}${statusStr}`);
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total users: ${users.length}`);
}

async function checkUser(email) {
  console.log(`🔍 Checking user: ${email}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      promoter: true,
      partner: true
    }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
  console.log(`   Email Verified: ${user.emailVerified ? '✅' : '❌'}`);
  console.log(`   Created: ${user.createdAt.toISOString()}`);
  
  if (user.promoter) {
    console.log('\n👤 Promoter Profile:');
    console.log(`   Promoter ID: ${user.promoter.id}`);
    console.log(`   Business Name: ${user.promoter.businessName}`);
    console.log(`   Tier: ${user.promoter.tier}`);
    console.log(`   Active: ${user.promoter.isActive ? '✅' : '❌'}`);
    console.log(`   Commission Rate: ${user.promoter.commissionRate}%`);
  }
  
  if (user.partner) {
    console.log('\n🏪 Partner Profile:');
    console.log(`   Partner ID: ${user.partner.id}`);
    console.log(`   Name: ${user.partner.name}`);
    console.log(`   Active: ${user.partner.isActive ? '✅' : '❌'}`);
  }

  // Check access permissions
  console.log('\n🔐 Access Permissions:');
  const promoterRoles = ['PROMOTER', 'PARTNER_PROMOTER', 'ADMIN'];
  const partnerRoles = ['PARTNER_ADMIN', 'PARTNER_USER', 'ADMIN'];
  
  console.log(`   Promoter Features: ${promoterRoles.includes(user.role) ? '✅' : '❌'}`);
  console.log(`   Partner Features: ${partnerRoles.includes(user.role) ? '✅' : '❌'}`);
  console.log(`   Admin Features: ${user.role === 'ADMIN' ? '✅' : '❌'}`);
}

async function updateUserRole(email, newRole) {
  if (!VALID_ROLES.includes(newRole)) {
    console.log(`❌ Invalid role: ${newRole}`);
    console.log(`Valid roles: ${VALID_ROLES.join(', ')}`);
    return;
  }

  console.log(`🔄 Updating user ${email} to role ${newRole}...`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`   Current role: ${user.role}`);
    
    if (user.role === newRole) {
      console.log('ℹ️  User already has this role');
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    console.log('✅ User role updated successfully:');
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   New Role: ${updatedUser.role}`);
    
    // Special handling for PROMOTER role
    if (newRole === 'PROMOTER' || newRole === 'PARTNER_PROMOTER') {
      const existingPromoter = await prisma.promoter.findUnique({
        where: { userId: user.id }
      });

      if (!existingPromoter) {
        console.log('\n⚠️  Note: User now has PROMOTER role but no promoter profile.');
        console.log('   You may need to create a promoter profile for full functionality.');
        console.log('   Run: node scripts/user-role-manager.js create-promoter ' + email);
      }
    }

  } catch (error) {
    console.error('❌ Error updating user role:', error.message);
  }
}

async function createPromoterProfile(email, businessName) {
  console.log(`👤 Creating promoter profile for: ${email}`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { promoter: true }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    if (user.role !== 'PROMOTER' && user.role !== 'PARTNER_PROMOTER') {
      console.log('❌ User must have PROMOTER or PARTNER_PROMOTER role first');
      console.log(`   Current role: ${user.role}`);
      console.log(`   Run: node scripts/user-role-manager.js update ${email} PROMOTER`);
      return;
    }

    if (user.promoter) {
      console.log('⚠️  User already has a promoter profile');
      console.log(`   Business Name: ${user.promoter.businessName}`);
      console.log(`   Active: ${user.promoter.isActive ? '✅' : '❌'}`);
      console.log(`   Tier: ${user.promoter.tier}`);
      return;
    }

    const defaultBusinessName = businessName || `${user.name} Business`;
    
    const promoter = await prisma.promoter.create({
      data: {
        userId: user.id,
        businessName: defaultBusinessName,
        commissionRate: 0.0200,
        tier: 'BRONZE',
        invitationQuota: 10,
        invitationsUsed: 0,
        totalCommissionsEarned: 0.00,
        totalPartnersInvited: 0,
        successfulInvitations: 0,
        isActive: true,
        approvedAt: new Date(),
        territory: null,
        specialization: null
      }
    });

    console.log('✅ Promoter profile created successfully:');
    console.log(`   Promoter ID: ${promoter.id}`);
    console.log(`   Business Name: ${promoter.businessName}`);
    console.log(`   Tier: ${promoter.tier}`);
    console.log(`   Commission Rate: ${promoter.commissionRate * 100}%`);
    console.log(`   Active: ${promoter.isActive ? '✅' : '❌'}`);
    console.log(`   Invitation Quota: ${promoter.invitationQuota}`);

  } catch (error) {
    console.error('❌ Error creating promoter profile:', error.message);
  }
}

async function showStats() {
  console.log('📊 User Role Statistics:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const roleStats = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true },
    orderBy: { _count: { role: 'desc' } }
  });

  const total = roleStats.reduce((sum, stat) => sum + stat._count.role, 0);

  roleStats.forEach(stat => {
    const percentage = ((stat._count.role / total) * 100).toFixed(1);
    console.log(`${stat.role.padEnd(15)} | ${stat._count.role.toString().padStart(3)} users (${percentage}%)`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total: ${total} users`);

  // Additional stats
  const activeUsers = await prisma.user.count({ where: { isActive: true } });
  const verifiedUsers = await prisma.user.count({ where: { emailVerified: true } });
  const promotersWithProfile = await prisma.promoter.count();

  console.log(`\nActive users: ${activeUsers}/${total} (${((activeUsers/total)*100).toFixed(1)}%)`);
  console.log(`Verified users: ${verifiedUsers}/${total} (${((verifiedUsers/total)*100).toFixed(1)}%)`);
  console.log(`Promoters with profile: ${promotersWithProfile}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'list':
        await listUsers();
        break;
      
      case 'check':
        if (!args[1]) {
          console.log('❌ Please provide an email address');
          process.exit(1);
        }
        await checkUser(args[1]);
        break;
      
      case 'update':
        if (!args[1] || !args[2]) {
          console.log('❌ Please provide email and new role');
          console.log('Usage: node user-role-manager.js update <email> <role>');
          process.exit(1);
        }
        await updateUserRole(args[1], args[2]);
        break;
      
      case 'stats':
        await showStats();
        break;
      
      case 'create-promoter':
        if (!args[1]) {
          console.log('❌ Please provide an email address');
          console.log('Usage: node user-role-manager.js create-promoter <email> [businessName]');
          process.exit(1);
        }
        await createPromoterProfile(args[1], args[2]);
        break;
      
      default:
        console.log('📖 User Role Manager');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Available commands:');
        console.log('  list                              - List all users with their roles');
        console.log('  check <email>                    - Check specific user\'s role and permissions');
        console.log('  update <email> <role>            - Update user\'s role');
        console.log('  create-promoter <email> [name]   - Create promoter profile for user');
        console.log('  stats                            - Show role distribution statistics');
        console.log('');
        console.log('Available roles: ' + VALID_ROLES.join(', '));
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/user-role-manager.js check user@example.com');
        console.log('  node scripts/user-role-manager.js update user@example.com PROMOTER');
        console.log('  node scripts/user-role-manager.js create-promoter user@example.com "My Business"');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();