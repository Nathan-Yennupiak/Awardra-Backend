"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlatformSettings = exports.deleteAdmin = exports.updateAdmin = exports.createAdmin = exports.getAdmins = exports.getFinancialReports = exports.getTransactions = exports.getPlatforms = void 0;
const database_1 = require("../../config/database");
const asyncHandler_1 = require("../../utils/asyncHandler");
const ApiError_1 = require("../../utils/ApiError");
const hash_1 = require("../../utils/hash");
exports.getPlatforms = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const platforms = await database_1.prisma.platform.findMany({
        include: { settings: true, adminUsers: { select: { id: true, email: true } } }
    });
    res.status(200).json({ success: true, data: platforms });
});
exports.getTransactions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const transactions = await database_1.prisma.paymentTransaction.findMany({
        include: {
            nomination: {
                include: {
                    awardCandidate: {
                        include: {
                            award: { select: { name: true, platformId: true } },
                            candidate: { select: { name: true } }
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    // Notice: Super Admin gets full financial details, including creatorFee and paystackFee
    res.status(200).json({ success: true, data: transactions });
});
exports.getFinancialReports = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const transactions = await database_1.prisma.paymentTransaction.findMany({
        where: { status: 'SUCCESS' }
    });
    const totalCustomerPayments = transactions.reduce((acc, t) => acc + t.customerPays, 0);
    const totalBaseRevenue = transactions.reduce((acc, t) => acc + t.baseAmount, 0);
    const totalPaystackFees = transactions.reduce((acc, t) => acc + t.paystackFee, 0);
    const totalCreatorFees = transactions.reduce((acc, t) => acc + t.creatorFee, 0);
    const totalOwnerNet = transactions.reduce((acc, t) => acc + t.ownerNet, 0);
    res.status(200).json({
        success: true,
        data: {
            totalCustomerPayments,
            totalBaseRevenue,
            totalPaystackFees,
            totalCreatorFees,
            totalOwnerNet,
            totalSuccessfulTransactions: transactions.length,
            currency: 'GHS'
        }
    });
});
exports.getAdmins = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const admins = await database_1.prisma.adminUser.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            platformId: true,
            plainPassword: true,
            createdAt: true,
            platform: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: admins });
});
exports.createAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const { email, password, role = 'ADMIN', platformId, status = 'ACTIVE' } = req.body;
    if (!email || !password) {
        return next(new ApiError_1.ApiError(400, 'Email and password are required'));
    }
    if (password.length < 6) {
        return next(new ApiError_1.ApiError(400, 'Password must be at least 6 characters'));
    }
    const existing = await database_1.prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
        return next(new ApiError_1.ApiError(400, 'An account with this email already exists'));
    }
    const passwordHash = await (0, hash_1.hashPassword)(password);
    const newAdmin = await database_1.prisma.adminUser.create({
        data: {
            email,
            passwordHash,
            plainPassword: password,
            role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
            platformId: platformId || null,
            status: status || 'ACTIVE',
        },
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            platformId: true,
            plainPassword: true,
            createdAt: true,
            platform: { select: { id: true, name: true, slug: true } }
        }
    });
    await database_1.prisma.auditLog.create({
        data: {
            adminUserId: req.user?.id || newAdmin.id,
            platformId: newAdmin.platformId,
            action: 'CREATE_ADMIN_USER',
            entity: 'AdminUser',
            entityId: newAdmin.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown',
        }
    });
    res.status(201).json({ success: true, message: 'Admin account created successfully', data: newAdmin });
});
exports.updateAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const id = req.params.id;
    const { email, password, role, platformId, status } = req.body;
    const admin = await database_1.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
        return next(new ApiError_1.ApiError(404, 'Admin account not found'));
    }
    if (email && email !== admin.email) {
        const existing = await database_1.prisma.adminUser.findUnique({ where: { email } });
        if (existing) {
            return next(new ApiError_1.ApiError(400, 'Email is already taken by another account'));
        }
    }
    const updateData = {};
    if (email)
        updateData.email = email;
    if (role)
        updateData.role = role;
    if (status)
        updateData.status = status;
    if (platformId !== undefined)
        updateData.platformId = platformId || null;
    if (password && password.trim() !== '') {
        if (password.length < 6) {
            return next(new ApiError_1.ApiError(400, 'Password must be at least 6 characters'));
        }
        updateData.passwordHash = await (0, hash_1.hashPassword)(password);
        updateData.plainPassword = password;
    }
    const updated = await database_1.prisma.adminUser.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            platformId: true,
            plainPassword: true,
            createdAt: true,
            platform: { select: { id: true, name: true, slug: true } }
        }
    });
    await database_1.prisma.auditLog.create({
        data: {
            adminUserId: req.user?.id || updated.id,
            platformId: updated.platformId,
            action: 'UPDATE_ADMIN_USER',
            entity: 'AdminUser',
            entityId: updated.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown',
        }
    });
    res.status(200).json({ success: true, message: 'Admin account updated successfully', data: updated });
});
exports.deleteAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const id = req.params.id;
    if (req.user?.id === id) {
        return next(new ApiError_1.ApiError(400, 'You cannot delete your own account'));
    }
    const admin = await database_1.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
        return next(new ApiError_1.ApiError(404, 'Admin account not found'));
    }
    await database_1.prisma.adminUser.delete({ where: { id } });
    await database_1.prisma.auditLog.create({
        data: {
            adminUserId: req.user?.id || id,
            platformId: admin.platformId,
            action: 'DELETE_ADMIN_USER',
            entity: 'AdminUser',
            entityId: id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown',
        }
    });
    res.status(200).json({ success: true, message: 'Admin account deleted successfully' });
});
exports.updatePlatformSettings = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const platformId = req.params.id;
    const { creatorFeePercentage, nominationFee } = req.body;
    const settings = await database_1.prisma.platformSettings.upsert({
        where: { platformId },
        create: {
            platformId,
            creatorFeePercentage,
            nominationFee: nominationFee ? parseInt(nominationFee) : 0,
            paystackFeePercentage: 1.95,
            defaultNominationTarget: 100,
            currency: 'GHS'
        },
        update: {
            ...(creatorFeePercentage !== undefined && { creatorFeePercentage }),
            ...(nominationFee !== undefined && { nominationFee: parseInt(nominationFee) })
        }
    });
    res.status(200).json({ success: true, data: settings });
});
