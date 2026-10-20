import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';

export const getAwards = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const awards = await prisma.award.findMany({
    where: { 
      status: 'PUBLISHED',
      visibility: 'PUBLIC'
    },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      imageUrl: true,
      startsAt: true,
      endsAt: true,
      platform: {
        select: {
          name: true,
          slug: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, data: awards });
});

export const getAwardBySlug = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.params.slug as string;
  
  const award = await prisma.award.findFirst({
    where: { 
      slug,
      status: 'PUBLISHED',
      visibility: 'PUBLIC'
    },
    include: {
      platform: {
        select: { name: true, slug: true }
      }
    }
  });

  if (!award) return next(new ApiError(404, 'Award not found'));

  if (award.nominationFee === null) {
    const platformSettings = await prisma.platformSettings.findUnique({
      where: { platformId: award.platformId }
    });
    award.nominationFee = platformSettings?.nominationFee || 10000;
  }

  res.status(200).json({ success: true, data: award });
});

export const getAwardCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.params.slug as string;
  
  const award = await prisma.award.findFirst({
    where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
  });

  if (!award) return next(new ApiError(404, 'Award not found'));

  const categories = await prisma.category.findMany({
    where: { 
      awardId: award.id,
      status: 'ACTIVE'
    },
    include: {
      _count: {
        select: { awardCandidates: true }
      }
    },
    orderBy: { displayOrder: 'asc' }
  });

  res.status(200).json({ success: true, data: categories });
});

export const getAwardCandidates = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.params.slug as string;
  
  const award = await prisma.award.findFirst({
    where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
  });

  if (!award) return next(new ApiError(404, 'Award not found'));

  const candidates = await prisma.awardCandidate.findMany({
    where: { 
      awardId: award.id,
      status: 'ACTIVE'
    },
    include: {
      candidate: true,
      category: {
        select: { name: true, slug: true }
      }
    },
    orderBy: { displayOrder: 'asc' }
  });

  const awardCandidateIds = candidates.map((ac) => ac.id);
  const votesData = await prisma.nomination.groupBy({
    by: ['awardCandidateId'],
    _sum: { votes: true },
    where: { 
      awardCandidateId: { in: awardCandidateIds }, 
      status: 'CONFIRMED' 
    }
  });

  const votesMap = new Map<string, number>();
  votesData.forEach((v) => {
    votesMap.set(v.awardCandidateId, v._sum.votes || 0);
  });

  const formatted = candidates.map((ac: any) => {
    const target = (ac.nominationTarget && ac.nominationTarget > 0)
      ? ac.nominationTarget
      : ((award.nominationTarget && award.nominationTarget > 0) ? award.nominationTarget : 100);
    const confirmed = votesMap.get(ac.id) || 0;
    const percentage = target > 0 ? Math.min(Math.round((confirmed / target) * 100), 100) : 0;

    return {
      id: ac.candidate.id,
      awardCandidateId: ac.id,
      name: ac.candidate.name,
      slug: ac.candidate.slug,
      photoUrl: ac.candidate.photoUrl,
      title: ac.candidate.title,
      organization: ac.candidate.organization,
      category: ac.category,
      nominationProgress: {
        confirmed,
        target,
        percentage
      }
    };
  });

  res.status(200).json({ success: true, data: formatted });
});

export const getCandidateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.params.slug as string;
  const candidateSlug = req.params.candidateSlug as string;
  
  const award = await prisma.award.findFirst({
    where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
  });

  if (!award) return next(new ApiError(404, 'Award not found'));

  if (award.nominationFee === null) {
    const platformSettings = await prisma.platformSettings.findUnique({
      where: { platformId: award.platformId }
    });
    award.nominationFee = platformSettings?.nominationFee || 10000;
  }

  const candidate = await prisma.candidate.findFirst({
    where: { slug: candidateSlug, status: 'ACTIVE' }
  });

  if (!candidate) return next(new ApiError(404, 'Candidate not found'));

  const awardCandidate = await prisma.awardCandidate.findFirst({
    where: {
      awardId: award.id,
      candidateId: candidate.id,
      status: 'ACTIVE'
    },
    include: {
      category: { select: { name: true, slug: true } }
    }
  });

  if (!awardCandidate) return next(new ApiError(404, 'Candidate is not assigned to this award'));

  const nominationSum = await prisma.nomination.aggregate({
    _sum: {
      votes: true
    },
    where: {
      awardCandidateId: awardCandidate.id,
      status: 'CONFIRMED'
    }
  });
  const confirmedCount = nominationSum._sum.votes || 0;

  const target = awardCandidate.nominationTarget || award.nominationTarget || 100;
  const percentage = Math.min(Math.round((confirmedCount / target) * 100), 100);

  res.status(200).json({ 
    success: true, 
    data: {
      id: candidate.id,
      awardCandidateId: awardCandidate.id,
      name: candidate.name,
      slug: candidate.slug,
      photoUrl: candidate.photoUrl,
      title: candidate.title,
      organization: candidate.organization,
      location: candidate.location,
      biography: candidate.biography,
      achievements: candidate.achievements,
      award: {
        name: award.name,
        slug: award.slug,
        nominationFee: award.nominationFee,
      },
      category: awardCandidate.category,
      nominationProgress: {
        confirmed: confirmedCount,
        target,
        percentage
      }
    } 
  });
});

export const getNominationProgress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.params.slug as string;
  const candidateSlug = req.params.candidateSlug as string;
  
  const award = await prisma.award.findFirst({
    where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
  });

  if (!award) return next(new ApiError(404, 'Award not found'));

  const candidate = await prisma.candidate.findFirst({
    where: { slug: candidateSlug, status: 'ACTIVE' }
  });

  if (!candidate) return next(new ApiError(404, 'Candidate not found'));

  const awardCandidate = await prisma.awardCandidate.findFirst({
    where: {
      awardId: award.id,
      candidateId: candidate.id,
      status: 'ACTIVE'
    }
  });

  if (!awardCandidate) return next(new ApiError(404, 'Candidate is not assigned to this award'));

  const nominationSum = await prisma.nomination.aggregate({
    _sum: {
      votes: true
    },
    where: {
      awardCandidateId: awardCandidate.id,
      status: 'CONFIRMED'
    }
  });
  const confirmedCount = nominationSum._sum.votes || 0;

  const target = awardCandidate.nominationTarget || award.nominationTarget || 100;
  const percentage = Math.min(Math.round((confirmedCount / target) * 100), 100);

  res.status(200).json({ 
    success: true, 
    data: {
      confirmed: confirmedCount,
      target,
      percentage
    }
  });
});

export const getAllCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const categories = await prisma.category.findMany({
    where: {
      status: 'ACTIVE'
    },
    include: {
      _count: {
        select: { awardCandidates: true }
      }
    }
  });

  const grouped = new Map();
  for (const cat of categories) {
    if (!grouped.has(cat.slug)) {
      grouped.set(cat.slug, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        count: cat._count.awardCandidates
      });
    } else {
      const existing = grouped.get(cat.slug);
      existing.count += cat._count.awardCandidates;
    }
  }

  const icons: Record<string, string> = {
    'technology-innovation': '🚀',
    'business-leadership': '💼',
    'arts-culture': '🎨',
    'science-research': '🔬',
    'health-wellness': '⚕️',
    'education-community': '📚',
    'environment-sustainability': '🌱',
    'media-entertainment': '🎬'
  };
  
  const result = Array.from(grouped.values()).map((cat: any) => ({
    ...cat,
    icon: icons[cat.slug] || '🏆'
  }));

  res.status(200).json({ success: true, data: result });
});
