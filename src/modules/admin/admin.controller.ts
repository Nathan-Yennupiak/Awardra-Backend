import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

// Largest per-nomination fee an award may set, in pesewas (GHS 1,000,000).
const MAX_NOMINATION_FEE = 100_000_000;

/**
 * Platform filter for the current user. Super admins see every platform
 * (undefined = no filter in Prisma); admins are pinned to their own.
 */
const scopedPlatformId = (req: Request): string | undefined =>
  req.user.role === 'SUPER_ADMIN' ? undefined : req.user.platformId;

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const firstIssue = (error: z.ZodError) => error.issues[0]?.message || 'Invalid request data';

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Slug is required')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and hyphens');

// '' and null both mean "clear the override"; undefined means "leave unchanged".
const nullableInt = (max: number) =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z.coerce.number().int().min(0).max(max).nullable().optional()
  );

const nullableText = z.string().nullable().optional();

const awardFields = {
  name: z.string().trim().min(1, 'Award name is required').max(200),
  slug: slugSchema,
  shortDescription: nullableText,
  description: nullableText,
  imageUrl: nullableText,
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  nominationFee: nullableInt(MAX_NOMINATION_FEE),
  nominationTarget: nullableInt(1_000_000_000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};

// Unknown keys (platformId, id, createdAt, ...) are stripped, so they can never reach Prisma.
const updateAwardSchema = z.object(awardFields).partial();

const createAwardSchema = z.object({
  ...awardFields,
  status: awardFields.status.optional(),
  visibility: awardFields.visibility.optional(),
  startsAt: awardFields.startsAt.optional(),
  endsAt: awardFields.endsAt.optional(),
  platformId: z.string().uuid().optional(),
  categories: z.array(z.any()).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema,
  description: nullableText,
  displayOrder: z.coerce.number().int().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE']),
}).partial();

const updateCandidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema,
  title: nullableText,
  organization: nullableText,
  biography: nullableText,
  achievements: nullableText,
  photoUrl: nullableText,
  status: z.enum(['ACTIVE', 'INACTIVE']),
}).partial();

/** Award slugs are globally unique because public URLs are /awards/:slug. */
const assertAwardSlugAvailable = async (slug: string, excludeAwardId?: string) => {
  const clash = await prisma.award.findFirst({
    where: { slug, ...(excludeAwardId && { NOT: { id: excludeAwardId } }) },
    select: { id: true },
  });
  if (clash) throw new ApiError(409, `The slug "${slug}" is already used by another award`);
};

/**
 * Which platform a new award belongs to. Admins always use their own; a super admin
 * may pass platformId, otherwise the only existing platform is used.
 */
const resolvePlatformForCreate = async (req: Request, requested?: string): Promise<string> => {
  if (req.user.role !== 'SUPER_ADMIN') return req.user.platformId;

  if (requested) {
    const platform = await prisma.platform.findUnique({ where: { id: requested }, select: { id: true } });
    if (!platform) throw new ApiError(400, 'Platform not found');
    return platform.id;
  }
  if (req.user.platformId) return req.user.platformId;

  const platforms = await prisma.platform.findMany({ select: { id: true }, take: 2 });
  if (platforms.length === 1) return platforms[0].id;
  throw new ApiError(400, platforms.length ? 'Choose which platform this award belongs to' : 'No platform exists yet');
};

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const platformId = scopedPlatformId(req);

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
  const platformId = scopedPlatformId(req);
  const awards = await prisma.award.findMany({
    where: { platformId },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, data: awards });
});

export const createAward = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = createAwardSchema.safeParse(req.body);
  if (!parsed.success) return next(new ApiError(400, firstIssue(parsed.error)));

  const { name, slug, description, shortDescription, visibility, imageUrl, nominationFee, nominationTarget, startsAt, endsAt, categories } = parsed.data;
  const platformId = await resolvePlatformForCreate(req, parsed.data.platformId);
  await assertAwardSlugAvailable(slug);

  const award = await prisma.$transaction(async (tx) => {
    const createdAward = await tx.award.create({
      data: {
        platformId,
        name,
        slug,
        description,
        shortDescription,
        imageUrl,
        nominationFee: nominationFee ?? null,
        nominationTarget: nominationTarget ?? null,
        startsAt: startsAt ?? new Date(),
        endsAt: endsAt ?? new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        visibility: visibility || 'PUBLIC',
        status: 'DRAFT'
      }
    });

    if (categories && categories.length > 0) {
      for (let i = 0; i < categories.length; i++) {
        const catData = categories[i];
        if (!catData?.name || typeof catData.name !== 'string' || !catData.name.trim()) continue;

        const catSlug = catData.slug || slugify(catData.name) + '-' + Math.random().toString(36).substring(2, 6);

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
            if (!candData?.name || typeof candData.name !== 'string' || !candData.name.trim()) continue;

            const candSlug = candData.slug ||
              slugify(candData.name) + '-' + Date.now().toString().slice(-4) + Math.random().toString(36).substring(2, 5);

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
  const platformId = scopedPlatformId(req);
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
  const platformId = scopedPlatformId(req);
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

export const createCandidate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const platformId = scopedPlatformId(req);
  const { name, slug, title, organization, biography, achievements, awardId, categoryId, photoUrl } = req.body;

  if (typeof awardId !== 'string' || typeof categoryId !== 'string') {
    return next(new ApiError(400, 'awardId and categoryId are required'));
  }

  // The category must belong to the award, and the award to the caller's platform.
  const category = await prisma.category.findFirst({
    where: { id: categoryId, awardId, award: { platformId } },
    select: { id: true }
  });
  if (!category) return next(new ApiError(403, 'Invalid award or category'));

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

export const updateAward = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const platformId = scopedPlatformId(req);

  const existing = await prisma.award.findFirst({ where: { id, platformId } });
  if (!existing) return next(new ApiError(404, 'Award not found'));

  const parsed = updateAwardSchema.safeParse(req.body);
  if (!parsed.success) return next(new ApiError(400, firstIssue(parsed.error)));

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    await assertAwardSlugAvailable(parsed.data.slug, id);
  }

  const updated = await prisma.award.update({ where: { id }, data: parsed.data });
  res.status(200).json({ success: true, data: updated });
});

export const updateCandidate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const platformId = scopedPlatformId(req);

  const existing = await prisma.candidate.findFirst({
    where: platformId ? { id, awards: { some: { award: { platformId } } } } : { id },
    select: { id: true }
  });
  if (!existing) return next(new ApiError(404, 'Candidate not found'));

  const parsed = updateCandidateSchema.safeParse(req.body);
  if (!parsed.success) return next(new ApiError(400, firstIssue(parsed.error)));

  const updated = await prisma.candidate.update({ where: { id }, data: parsed.data });
  res.status(200).json({ success: true, data: updated });
});

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const platformId = scopedPlatformId(req);
  const categories = await prisma.category.findMany({
    where: { award: { platformId } },
    include: { award: true },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ success: true, data: categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const platformId = scopedPlatformId(req);
  const { name, slug, description, awardId } = req.body;

  const award = await prisma.award.findFirst({ where: { id: awardId, platformId } });
  if (!award) return next(new ApiError(403, 'Invalid award'));

  const category = await prisma.category.create({
    data: { awardId, name, slug, description, status: 'ACTIVE' }
  });
  res.status(201).json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const platformId = scopedPlatformId(req);

  const existing = await prisma.category.findFirst({ where: { id, award: { platformId } }, select: { id: true } });
  if (!existing) return next(new ApiError(404, 'Category not found'));

  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return next(new ApiError(400, firstIssue(parsed.error)));

  const updated = await prisma.category.update({ where: { id }, data: parsed.data });
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

export const deleteAward = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const existing = await prisma.award.findFirst({ where: { id, platformId: scopedPlatformId(req) }, select: { id: true } });
  if (!existing) return next(new ApiError(404, 'Award not found'));

  await prisma.award.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Award deleted successfully' });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const existing = await prisma.category.findFirst({
    where: { id, award: { platformId: scopedPlatformId(req) } },
    select: { id: true }
  });
  if (!existing) return next(new ApiError(404, 'Category not found'));

  await prisma.category.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Category deleted successfully' });
});

/**
 * Removes a candidate from awards. Optional ?awardId= / ?categoryId= narrow the removal
 * to one award or category; without them every assignment on the caller's platform is
 * removed. The Candidate row itself is deleted only once no assignments remain anywhere.
 */
export const deleteCandidate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const platformId = scopedPlatformId(req);
  const awardId = typeof req.query.awardId === 'string' ? req.query.awardId : undefined;
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;

  const linkWhere = {
    candidateId: id,
    ...(awardId && { awardId }),
    ...(categoryId && { categoryId }),
    ...(platformId && { award: { platformId } }),
  };

  const linkCount = await prisma.awardCandidate.count({ where: linkWhere });
  if (linkCount === 0) return next(new ApiError(404, 'Candidate not found'));

  const candidateDeleted = await prisma.$transaction(async (tx) => {
    await tx.awardCandidate.deleteMany({ where: linkWhere });
    const remaining = await tx.awardCandidate.count({ where: { candidateId: id } });
    if (remaining > 0) return false;
    await tx.candidate.delete({ where: { id } });
    return true;
  });

  res.status(200).json({
    success: true,
    message: candidateDeleted ? 'Candidate deleted successfully' : 'Candidate removed successfully'
  });
});
