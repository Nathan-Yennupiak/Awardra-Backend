"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const hash_1 = require("../src/utils/hash");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting seed...');
    // Create platform
    const platform = await prisma.platform.upsert({
        where: { slug: 'default-awards' },
        update: {},
        create: {
            name: 'Default Awards Platform',
            slug: 'default-awards',
            description: 'The premier awards platform',
            status: 'ACTIVE'
        }
    });
    console.log(`Created platform: ${platform.name}`);
    // Create Super Admin
    const superAdminPassword = await (0, hash_1.hashPassword)('superadmin123');
    await prisma.adminUser.upsert({
        where: { email: 'superadmin@example.com' },
        update: {},
        create: {
            email: 'superadmin@example.com',
            passwordHash: superAdminPassword,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE'
        }
    });
    // Create Admin
    const adminPassword = await (0, hash_1.hashPassword)('admin123');
    const adminUser = await prisma.adminUser.upsert({
        where: { email: 'admin@example.com' },
        update: { platformId: platform.id },
        create: {
            email: 'admin@example.com',
            passwordHash: adminPassword,
            role: 'ADMIN',
            platformId: platform.id,
            status: 'ACTIVE'
        }
    });
    await prisma.platform.update({
        where: { id: platform.id },
        data: { ownerAdminId: adminUser.id }
    });
    // Create platform settings
    await prisma.platformSettings.upsert({
        where: { platformId: platform.id },
        update: {},
        create: {
            platformId: platform.id,
            nominationFee: 10000,
            creatorFeePercentage: 5.00,
            paystackFeePercentage: 1.95,
            defaultNominationTarget: 100,
            currency: 'GHS'
        }
    });
    // Create Award
    const award = await prisma.award.upsert({
        where: { platformId_slug: { platformId: platform.id, slug: 'national-excellence-2026' } },
        update: {},
        create: {
            platformId: platform.id,
            name: 'National Excellence Awards 2026',
            slug: 'national-excellence-2026',
            status: 'PUBLISHED',
            visibility: 'PUBLIC'
        }
    });
    // Create Category
    const category = await prisma.category.upsert({
        where: { awardId_slug: { awardId: award.id, slug: 'innovator-of-the-year' } },
        update: {},
        create: {
            awardId: award.id,
            name: 'Innovator of the Year',
            slug: 'innovator-of-the-year',
            status: 'ACTIVE'
        }
    });
    // Create Candidate
    const candidate = await prisma.candidate.upsert({
        where: { slug: 'jane-doe' },
        update: {},
        create: {
            name: 'Jane Doe',
            slug: 'jane-doe',
            title: 'Founder',
            organization: 'Tech Innovators',
            status: 'ACTIVE'
        }
    });
    // Assign candidate to award
    await prisma.awardCandidate.upsert({
        where: { awardId_candidateId_categoryId: { awardId: award.id, candidateId: candidate.id, categoryId: category.id } },
        update: {},
        create: {
            awardId: award.id,
            candidateId: candidate.id,
            categoryId: category.id,
            status: 'ACTIVE',
            nominationTarget: 100
        }
    });
    console.log('✅ Seeding completed');
}
main()
    .catch(e => {
    console.error('❌ Seeding failed', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map