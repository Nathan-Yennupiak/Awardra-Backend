"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCategories = exports.getNominationProgress = exports.getCandidateProfile = exports.getAwardCandidates = exports.getAwardCategories = exports.getAwardBySlug = exports.getAwards = void 0;
const database_1 = require("../../config/database");
const ApiError_1 = require("../../utils/ApiError");
const asyncHandler_1 = require("../../utils/asyncHandler");
exports.getAwards = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const awards = await database_1.prisma.award.findMany({
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
exports.getAwardBySlug = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const slug = req.params.slug;
    const award = await database_1.prisma.award.findFirst({
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
    if (!award)
        return next(new ApiError_1.ApiError(404, 'Award not found'));
    if (award.nominationFee === null) {
        const platformSettings = await database_1.prisma.platformSettings.findUnique({
            where: { platformId: award.platformId }
        });
        award.nominationFee = platformSettings?.nominationFee || 10000;
    }
    res.status(200).json({ success: true, data: award });
});
exports.getAwardCategories = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const slug = req.params.slug;
    const award = await database_1.prisma.award.findFirst({
        where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
    });
    if (!award)
        return next(new ApiError_1.ApiError(404, 'Award not found'));
    const categories = await database_1.prisma.category.findMany({
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
exports.getAwardCandidates = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const slug = req.params.slug;
    const award = await database_1.prisma.award.findFirst({
        where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
    });
    if (!award)
        return next(new ApiError_1.ApiError(404, 'Award not found'));
    const candidates = await database_1.prisma.awardCandidate.findMany({
        where: {
            awardId: award.id,
            status: 'ACTIVE'
        },
        include: {
            candidate: true,
            category: {
                select: { name: true, slug: true }
            },
            _count: {
                select: { nominations: { where: { status: 'CONFIRMED' } } }
            }
        },
        orderBy: { displayOrder: 'asc' }
    });
    const formatted = candidates.map((ac) => {
        const target = ac.nominationTarget || award.nominationTarget || 100;
        const confirmed = ac._count?.nominations || 0;
        const percentage = Math.min(Math.round((confirmed / target) * 100), 100);
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
exports.getCandidateProfile = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const slug = req.params.slug;
    const candidateSlug = req.params.candidateSlug;
    const award = await database_1.prisma.award.findFirst({
        where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
    });
    if (!award)
        return next(new ApiError_1.ApiError(404, 'Award not found'));
    if (award.nominationFee === null) {
        const platformSettings = await database_1.prisma.platformSettings.findUnique({
            where: { platformId: award.platformId }
        });
        award.nominationFee = platformSettings?.nominationFee || 10000;
    }
    const candidate = await database_1.prisma.candidate.findFirst({
        where: { slug: candidateSlug, status: 'ACTIVE' }
    });
    if (!candidate)
        return next(new ApiError_1.ApiError(404, 'Candidate not found'));
    const awardCandidate = await database_1.prisma.awardCandidate.findFirst({
        where: {
            awardId: award.id,
            candidateId: candidate.id,
            status: 'ACTIVE'
        },
        include: {
            category: { select: { name: true, slug: true } }
        }
    });
    if (!awardCandidate)
        return next(new ApiError_1.ApiError(404, 'Candidate is not assigned to this award'));
    const nominationSum = await database_1.prisma.nomination.aggregate({
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
exports.getNominationProgress = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const slug = req.params.slug;
    const candidateSlug = req.params.candidateSlug;
    const award = await database_1.prisma.award.findFirst({
        where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' }
    });
    if (!award)
        return next(new ApiError_1.ApiError(404, 'Award not found'));
    const candidate = await database_1.prisma.candidate.findFirst({
        where: { slug: candidateSlug, status: 'ACTIVE' }
    });
    if (!candidate)
        return next(new ApiError_1.ApiError(404, 'Candidate not found'));
    const awardCandidate = await database_1.prisma.awardCandidate.findFirst({
        where: {
            awardId: award.id,
            candidateId: candidate.id,
            status: 'ACTIVE'
        }
    });
    if (!awardCandidate)
        return next(new ApiError_1.ApiError(404, 'Candidate is not assigned to this award'));
    const nominationSum = await database_1.prisma.nomination.aggregate({
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
exports.getAllCategories = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const categories = await database_1.prisma.category.findMany({
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
        }
        else {
            const existing = grouped.get(cat.slug);
            existing.count += cat._count.awardCandidates;
        }
    }
    const icons = {
        'technology-innovation': '🚀',
        'business-leadership': '💼',
        'arts-culture': '🎨',
        'science-research': '🔬',
        'health-wellness': '⚕️',
        'education-community': '📚',
        'environment-sustainability': '🌱',
        'media-entertainment': '🎬'
    };
    const result = Array.from(grouped.values()).map((cat) => ({
        ...cat,
        icon: icons[cat.slug] || '🏆'
    }));
    res.status(200).json({ success: true, data: result });
});
