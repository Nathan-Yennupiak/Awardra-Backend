"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlatformSettings = exports.getAdmins = exports.getFinancialReports = exports.getTransactions = exports.getPlatforms = void 0;
const database_1 = require("../../config/database");
const asyncHandler_1 = require("../../utils/asyncHandler");
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
        select: { id: true, email: true, role: true, status: true, platformId: true, createdAt: true }
    });
    res.status(200).json({ success: true, data: admins });
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
