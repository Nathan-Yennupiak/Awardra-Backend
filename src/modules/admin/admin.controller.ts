import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../utils/asyncHandler';

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;

  const totalAwards = await prisma.award.count({ where: { platformId } });
  
  const totalCategories = await prisma.category.count({ 
    where: { award: { platformId } } 
  });
  
  const totalCandidates = await prisma.candidate.count({
    where: { awards: { some: { award: { platformId } } } }
  });
  
  const transactions = await prisma.paymentTransaction.findMany({
    where: { 
      nomination: { awardCandidate: { award: { platformId } } },
      status: 'SUCCESS' 
    }
  });

  const totalRevenue = transactions.reduce((acc: number, curr: any) => acc + curr.ownerNet, 0);
  const totalCreatorFee = req.user.role === 'SUPER_ADMIN' 
    ? transactions.reduce((acc: number, curr: any) => acc + curr.creatorFee, 0)
    : undefined;

  res.status(200).json({
    success: true,
    data: {
      totalAwards,
      totalCategories,
      totalCandidates,
      totalRevenue,
      ...(req.user.role === 'SUPER_ADMIN' && { totalPlatformCommission: totalCreatorFee }),
      currency: 'GHS'
    }
  });
});

export const getAwards = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  const awards = await prisma.award.findMany({
    where: { platformId },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, data: awards });
});

export const createAward = asyncHandler(async (req: Request, res: Response) => {
  let platformId = req.user.platformId;
  if (req.user.role === 'SUPER_ADMIN' && !platformId) {
    const platform = await prisma.platform.findFirst();
    platformId = platform?.id;
  }
  const { name, slug, description, shortDescription, visibility, imageUrl, nominationFee, nominationTarget, startsAt, endsAt, categories } = req.body;

  const award = await prisma.$transaction(async (tx) => {
    const createdAward = await tx.award.create({
      data: {
        platformId,
        name,
        slug,
        description,
        shortDescription,
        imageUrl,
        nominationFee: (nominationFee !== undefined && nominationFee !== null && nominationFee !== '') ? parseInt(nominationFee) : null,
        nominationTarget: (nominationTarget !== undefined && nominationTarget !== null && nominationTarget !== '') ? parseInt(nominationTarget) : null,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        visibility: visibility || 'PUBLIC',
        status: 'DRAFT'
      }
    });

    if (categories && Array.isArray(categories) && categories.length > 0) {
      for (let i = 0; i < categories.length; i++) {
        const catData = categories[i];
        if (!catData.name || !catData.name.trim()) continue;

        const catSlug = catData.slug || 
          catData.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 6);

        const createdCategory = await tx.category.create({
          data: {
            awardId: createdAward.id,
            name: catData.name.trim(),
            slug: catSlug,
            description: catData.description || null,
            displayOrder: i,
            status: 'ACTIVE'
          }
        });

        if (catData.candidates && Array.isArray(catData.candidates) && catData.candidates.length > 0) {
          for (let j = 0; j < catData.candidates.length; j++) {
            const candData = catData.candidates[j];
            if (!candData.name || !candData.name.trim()) continue;

            const candSlug = candData.slug ||
              candData.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4) + Math.random().toString(36).substring(2, 5);

            const createdCandidate = await tx.candidate.create({
              data: {
                name: candData.name.trim(),
                slug: candSlug,
                title: candData.title || null,
                organization: candData.organization || null,
                biography: candData.biography || null,
                achievements: candData.achievements || null,
                photoUrl: candData.photoUrl || null,
                status: 'ACTIVE'
              }
            });

            await tx.awardCandidate.create({
              data: {
                awardId: createdAward.id,
                categoryId: createdCategory.id,
                candidateId: createdCandidate.id,
                displayOrder: j,
                status: 'ACTIVE'
              }
            });
          }
        }
      }
    }

    return createdAward;
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminUserId: req.user.id,
      platformId,
      action: 'AWARD_CREATED',
      entity: 'Award',
      entityId: award.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
    }
  });

  res.status(201).json({ success: true, data: award });
});

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
  
  const transactions = await prisma.paymentTransaction.findMany({
    where: { 
      nomination: { awardCandidate: { award: { platformId } } },
      status: 'SUCCESS' 
    },
    orderBy: { paidAt: 'desc' },
    select: {
      id: true,
      baseAmount: true,
      ownerNet: true,
      ...(isSuperAdmin && {
        customerPays: true,
        paystackFee: true,
        creatorFee: true
      }),
      currency: true,
      paidAt: true,
      status: true,
      nomination: {
        select: { 
          reference: true,
          awardCandidate: {
            select: {
              award: { select: { id: true, name: true } },
              candidate: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  const totalRevenue = transactions.reduce((acc, curr) => acc + curr.ownerNet, 0);

  res.status(200).json({
    success: true,
    data: {
      totalTransactions: transactions.length,
      totalOwnerNetRevenue: totalRevenue,
      transactions
    }
  });
});

export const getCandidates = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  const candidates = await prisma.candidate.findMany({
    where: { awards: { some: { award: { platformId } } } },
    include: {
      awards: {
        include: { 
          award: true, 
          category: true,
          _count: {
            select: { nominations: { where: { status: 'CONFIRMED' } } }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const awardCandidateIds = candidates.flatMap(c => c.awards.map(a => a.id));
  const votesData = await prisma.nomination.groupBy({
    by: ['awardCandidateId'],
    _sum: { votes: true },
    where: { awardCandidateId: { in: awardCandidateIds }, status: 'CONFIRMED' }
  });

  const candidatesWithVotes = candidates.map(candidate => ({
    ...candidate,
    awards: candidate.awards.map(ac => {
      const voteAgg = votesData.find(v => v.awardCandidateId === ac.id);
      return {
        ...ac,
        _count: {
          ...ac._count,
          nominations: voteAgg?._sum.votes || 0
        }
      };
    })
  }));

  res.status(200).json({ success: true, data: candidatesWithVotes });
});

export const createCandidate = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  const { name, slug, title, organization, biography, achievements, awardId, categoryId, photoUrl } = req.body;

  // Security check: verify award belongs to platform
  const award = await prisma.award.findFirst({
    where: { id: awardId, platformId }
  });
  if (!award) {
    res.status(403).json({ success: false, message: 'Invalid award' });
    return;
  }

  const candidate = await prisma.candidate.create({
    data: {
      name,
      slug,
      title,
      organization,
      biography,
      achievements,
      photoUrl,
      awards: {
        create: {
          awardId,
          categoryId
        }
      }
    },
    include: {
      awards: {
        include: { award: true, category: true }
      }
    }
  });

  res.status(201).json({ success: true, data: candidate });
});

export const updateAward = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  
  const existing = await prisma.award.findFirst({ where: { id, platformId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Award not found' });
    return;
  }
  
  const dataToUpdate = { ...req.body };
  if (dataToUpdate.nominationFee !== undefined) {
    dataToUpdate.nominationFee = (dataToUpdate.nominationFee !== null && dataToUpdate.nominationFee !== '')
      ? parseInt(dataToUpdate.nominationFee)
      : null;
  }
  if (dataToUpdate.nominationTarget !== undefined) {
    dataToUpdate.nominationTarget = (dataToUpdate.nominationTarget !== null && dataToUpdate.nominationTarget !== '')
      ? parseInt(dataToUpdate.nominationTarget)
      : null;
  }
  if (dataToUpdate.startsAt) dataToUpdate.startsAt = new Date(dataToUpdate.startsAt);
  if (dataToUpdate.endsAt) dataToUpdate.endsAt = new Date(dataToUpdate.endsAt);

  const updated = await prisma.award.update({ where: { id }, data: dataToUpdate });
  res.status(200).json({ success: true, data: updated });
});

export const updateCandidate = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, slug, title, organization, biography, achievements, photoUrl, status } = req.body;
  const dataToUpdate: any = {};
  if (name !== undefined) dataToUpdate.name = name;
  if (slug !== undefined) dataToUpdate.slug = slug;
  if (title !== undefined) dataToUpdate.title = title;
  if (organization !== undefined) dataToUpdate.organization = organization;
  if (biography !== undefined) dataToUpdate.biography = biography;
  if (achievements !== undefined) dataToUpdate.achievements = achievements;
  if (photoUrl !== undefined) dataToUpdate.photoUrl = photoUrl;
  if (status !== undefined) dataToUpdate.status = status;

  const updated = await prisma.candidate.update({ where: { id }, data: dataToUpdate });
  res.status(200).json({ success: true, data: updated });
});

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  const categories = await prisma.category.findMany({
    where: { award: { platformId } },
    include: { award: true },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ success: true, data: categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;
  const { name, slug, description, awardId } = req.body;
  
  const award = await prisma.award.findFirst({ where: { id: awardId, platformId } });
  if (!award) {
    res.status(403).json({ success: false, message: 'Invalid award' });
    return;
  }
  
  const category = await prisma.category.create({
    data: { awardId, name, slug, description, status: 'ACTIVE' }
  });
  res.status(201).json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updated = await prisma.category.update({ where: { id }, data: req.body });
  res.status(200).json({ success: true, data: updated });
});

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }
  
  // multer-storage-cloudinary sets the full URL in req.file.path
  const fileUrl = req.file.path;
  res.status(200).json({ success: true, data: { url: fileUrl } });
});

export const deleteAward = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.award.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Award deleted successfully' });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.category.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Category deleted successfully' });
});

export const deleteCandidate = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.awardCandidate.deleteMany({ where: { candidateId: id } });
  await prisma.candidate.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Candidate deleted successfully' });
});

