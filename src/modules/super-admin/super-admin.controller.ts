import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/hash';

export const getPlatforms = asyncHandler(async (req: Request, res: Response) => {
  const platforms = await prisma.platform.findMany({
    include: { settings: true, adminUsers: { select: { id: true, email: true } } }
  });

  res.status(200).json({ success: true, data: platforms });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await prisma.paymentTransaction.findMany({
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

export const getFinancialReports = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await prisma.paymentTransaction.findMany({
    where: { status: 'SUCCESS' }
  });

  const totalCustomerPayments = transactions.reduce((acc: number, t: any) => acc + t.customerPays, 0);
  const totalBaseRevenue = transactions.reduce((acc: number, t: any) => acc + t.baseAmount, 0);
  const totalPaystackFees = transactions.reduce((acc: number, t: any) => acc + t.paystackFee, 0);
  const totalCreatorFees = transactions.reduce((acc: number, t: any) => acc + t.creatorFee, 0);
  const totalOwnerNet = transactions.reduce((acc: number, t: any) => acc + t.ownerNet, 0);

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

export const getAdmins = asyncHandler(async (req: Request, res: Response) => {
  const admins = await prisma.adminUser.findMany({
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

export const createAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, role = 'ADMIN', platformId, status = 'ACTIVE' } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, 'Email and password are required'));
  }

  if (password.length < 6) {
    return next(new ApiError(400, 'Password must be at least 6 characters'));
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return next(new ApiError(400, 'An account with this email already exists'));
  }

  const passwordHash = await hashPassword(password);

  const newAdmin = await prisma.adminUser.create({
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

  await prisma.auditLog.create({
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

export const updateAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { email, password, role, platformId, status } = req.body;

  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) {
    return next(new ApiError(404, 'Admin account not found'));
  }

  if (email && email !== admin.email) {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return next(new ApiError(400, 'Email is already taken by another account'));
    }
  }

  const updateData: any = {};
  if (email) updateData.email = email;
  if (role) updateData.role = role;
  if (status) updateData.status = status;
  if (platformId !== undefined) updateData.platformId = platformId || null;

  if (password && password.trim() !== '') {
    if (password.length < 6) {
      return next(new ApiError(400, 'Password must be at least 6 characters'));
    }
    updateData.passwordHash = await hashPassword(password);
    updateData.plainPassword = password;
  }

  const updated = await prisma.adminUser.update({
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

  await prisma.auditLog.create({
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

export const deleteAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;

  if (req.user?.id === id) {
    return next(new ApiError(400, 'You cannot delete your own account'));
  }

  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) {
    return next(new ApiError(404, 'Admin account not found'));
  }

  await prisma.adminUser.delete({ where: { id } });

  await prisma.auditLog.create({
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

export const updatePlatformSettings = asyncHandler(async (req: Request, res: Response) => {
  const platformId = req.params.id as string;
  const { creatorFeePercentage, nominationFee } = req.body;

  const settings = await prisma.platformSettings.upsert({
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
