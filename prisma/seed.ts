import { hashPassword } from '../src/utils/hash';
import { prisma } from '../src/config/database';

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Clear existing awards, categories, and candidates
  console.log('🧹 Clearing existing data...');
  await prisma.nomination.deleteMany();
  await prisma.awardCandidate.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.category.deleteMany();
  await prisma.award.deleteMany();
  // Note: Platform and Admin users are kept.

  // Re-ensure platform exists
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

  // Re-ensure admin users and settings
  const superAdminPassword = await hashPassword('superadmin123');
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

  const adminPassword = await hashPassword('admin123');
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

  await prisma.platformSettings.upsert({
    where: { platformId: platform.id },
    update: {},
    create: {
      platformId: platform.id,
      nominationFee: 10000,
      creatorFeePercentage: 3.00,
      paystackFeePercentage: 1.95,
      defaultNominationTarget: 100,
      currency: 'GHS'
    }
  });

  // 2. Create new Awards
  console.log('🏆 Creating new awards...');
  const now = new Date();
  const startsAt = new Date(now.getFullYear(), now.getMonth(), 1);
  const endsAt = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const award = await prisma.award.create({
    data: {
      platformId: platform.id,
      name: 'Tech Awards 2027',
      slug: 'tech-awards-2027',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      shortDescription: 'The biggest technology awards event of 2027.',
      description: 'Celebrating the brightest minds and most innovative products in the technology industry.',
      startsAt,
      endsAt
    }
  });

  // 3. Create at least 5 Categories
  console.log('📂 Creating categories...');
  const categoryNames = [
    'Best Software Startup',
    'AI Innovation of the Year',
    'Top Cloud Solution',
    'Cybersecurity Excellence',
    'Outstanding Tech Leader'
  ];

  const categories = [];
  for (let i = 0; i < categoryNames.length; i++) {
    const category = await prisma.category.create({
      data: {
        awardId: award.id,
        name: categoryNames[i],
        slug: categoryNames[i].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: `Recognizing the best in ${categoryNames[i]}.`,
        status: 'ACTIVE',
        displayOrder: i
      }
    });
    categories.push(category);
  }

  // 4. Create 10 Nominees and assign to different categories
  console.log('👥 Creating 10 nominees...');
  const candidatesData = [
    { gender: 'women', first: 'Alice', last: 'Johnson', title: 'CEO', org: 'AlphaTech' },
    { gender: 'men', first: 'Bob', last: 'Smith', title: 'CTO', org: 'BetaSystems' },
    { gender: 'women', first: 'Clara', last: 'Davis', title: 'Founder', org: 'GammaCloud' },
    { gender: 'men', first: 'David', last: 'Wilson', title: 'Lead Engineer', org: 'DeltaSec' },
    { gender: 'women', first: 'Eva', last: 'Brown', title: 'Director of AI', org: 'EpsilonAI' },
    { gender: 'men', first: 'Frank', last: 'Miller', title: 'Product Manager', org: 'ZetaSoft' },
    { gender: 'women', first: 'Grace', last: 'Taylor', title: 'Security Analyst', org: 'EtaCyber' },
    { gender: 'men', first: 'Henry', last: 'Anderson', title: 'VP of Engineering', org: 'ThetaCorp' },
    { gender: 'women', first: 'Ivy', last: 'Thomas', title: 'Data Scientist', org: 'IotaData' },
    { gender: 'men', first: 'Jack', last: 'Moore', title: 'Managing Director', org: 'KappaTech' }
  ];

  for (let i = 0; i < candidatesData.length; i++) {
    const person = candidatesData[i];
    const name = `${person.first} ${person.last}`;
    const candidateSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const photoId = i + 10; // offset to get nice randomuser pics

    // Create candidate
    const candidate = await prisma.candidate.create({
      data: {
        name,
        slug: candidateSlug,
        title: person.title,
        organization: person.org,
        photoUrl: `https://randomuser.me/api/portraits/${person.gender}/${photoId}.jpg`,
        biography: `${name} is an outstanding professional known for amazing work at ${person.org}.`,
        achievements: `1. Launched multiple successful products\n2. Award winning innovation`,
        location: 'Global',
        status: 'ACTIVE'
      }
    });

    // Assign to a category (distribute evenly across the 5 categories: 2 per category)
    const categoryIndex = i % categories.length;
    await prisma.awardCandidate.create({
      data: {
        awardId: award.id,
        candidateId: candidate.id,
        categoryId: categories[categoryIndex].id,
        status: 'ACTIVE',
        nominationTarget: 100
      }
    });
  }

  // 5. Create Youth Shakers Awards
  console.log('🏆 Creating Youth Shakers Awards...');
  const youthAward = await prisma.award.create({
    data: {
      platformId: platform.id,
      name: 'Youth Shakers Awards - Ghana Edition',
      slug: 'youth-shakers-awards-ghana',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      shortDescription: 'Empowering and celebrating the youth of Ghana.',
      description: 'The Youth Shakers Awards - Ghana Edition is designed to recognize and celebrate the exceptional achievements of young Ghanaians.',
      startsAt,
      endsAt
    }
  });

  console.log('📂 Creating Youth categories...');
  const youthCategoryNames = [
    'Youth in Tech',
    'Creative Arts & Entertainment',
    'Young Entrepreneur of the Year',
    'Social Impact & Activism',
    'Sports Personality',
    'Media & Journalism',
    'Student Leader of the Year'
  ];

  const youthCategories = [];
  for (let i = 0; i < youthCategoryNames.length; i++) {
    const category = await prisma.category.create({
      data: {
        awardId: youthAward.id,
        name: youthCategoryNames[i],
        slug: youthCategoryNames[i].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: `Recognizing the best in ${youthCategoryNames[i]}.`,
        status: 'ACTIVE',
        displayOrder: i
      }
    });
    youthCategories.push(category);
  }

  console.log('👥 Creating 30 youth nominees...');
  for (let i = 0; i < 30; i++) {
    const gender = i % 2 === 0 ? 'women' : 'men';
    const first = gender === 'men' ? `Kwame${i}` : `Ama${i}`;
    const last = `Mensah${i}`;
    const name = `${first} ${last}`;
    const candidateSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const photoId = i + 30; 

    // Create candidate
    const candidate = await prisma.candidate.create({
      data: {
        name,
        slug: candidateSlug,
        title: 'Youth Leader',
        organization: 'Ghana Youth Forum',
        photoUrl: `https://randomuser.me/api/portraits/${gender}/${photoId}.jpg`,
        biography: `${name} is a vibrant youth leader making waves in their community.`,
        achievements: `1. Organized massive community outreach\n2. Awarded Youth Star`,
        location: 'Accra, Ghana',
        status: 'ACTIVE'
      }
    });

    const categoryIndex = i % youthCategories.length;
    await prisma.awardCandidate.create({
      data: {
        awardId: youthAward.id,
        candidateId: candidate.id,
        categoryId: youthCategories[categoryIndex].id,
        status: 'ACTIVE',
        nominationTarget: 100
      }
    });
  }

  // 6. Create 5 additional awards
  console.log('🏆 Creating 5 additional awards...');
  const extraAwardsData = [
    { name: 'Women in Leadership Honours', slug: 'women-in-leadership', img: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6' },
    { name: 'Creative Excellence Awards', slug: 'creative-excellence', img: 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34' },
    { name: 'Sustainable Future Prize', slug: 'sustainable-future', img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc' },
    { name: 'Global Finance Awards', slug: 'global-finance-awards', img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3' },
    { name: 'Healthcare Heroes Awards', slug: 'healthcare-heroes-awards', img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef' }
  ];

  for (let idx = 0; idx < extraAwardsData.length; idx++) {
    const data = extraAwardsData[idx];
    const newAward = await prisma.award.create({
      data: {
        platformId: platform.id,
        name: data.name,
        slug: data.slug,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        imageUrl: data.img + '?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        shortDescription: `Celebrating excellence in ${data.name}.`,
        description: `This award recognizes the most outstanding achievements and contributions in the field of ${data.name}.`,
        startsAt,
        endsAt
      }
    });

    const extraCategories = [];
    for (let c = 1; c <= 3; c++) {
      const cat = await prisma.category.create({
        data: {
          awardId: newAward.id,
          name: `Category ${c}`,
          slug: `category-${c}`,
          description: `General category ${c} for ${data.name}`,
          status: 'ACTIVE',
          displayOrder: c
        }
      });
      extraCategories.push(cat);
    }

    for (let n = 1; n <= 6; n++) {
      const gender = n % 2 === 0 ? 'women' : 'men';
      const name = `Nominee ${n} of ${data.slug}`;
      const candidateSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const photoId = n + (idx * 10);
      
      const candidate = await prisma.candidate.create({
        data: {
          name,
          slug: candidateSlug,
          title: 'Professional',
          organization: 'Global Org',
          photoUrl: `https://randomuser.me/api/portraits/${gender}/${photoId}.jpg`,
          biography: `${name} is an outstanding professional.`,
          achievements: `1. Outstanding performance`,
          location: 'Global',
          status: 'ACTIVE'
        }
      });

      const catIndex = n % extraCategories.length;
      await prisma.awardCandidate.create({
        data: {
          awardId: newAward.id,
          candidateId: candidate.id,
          categoryId: extraCategories[catIndex].id,
          status: 'ACTIVE',
          nominationTarget: 50
        }
      });
    }
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
