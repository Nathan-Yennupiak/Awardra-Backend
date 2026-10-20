import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { verifyPassword, hashPassword } from '../../utils/hash';
import { generateToken } from '../../utils/jwt';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new ApiError(400, 'Invalid request data'));
  }

  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!user || user.status !== 'ACTIVE') {
    return next(new ApiError(401, 'Invalid credentials'));
  }

  const isMatch = await verifyPassword(user.passwordHash, password);
  if (!isMatch) {
    return next(new ApiError(401, 'Invalid credentials'));
  }

  const token = generateToken({ id: user.id, role: user.role });

  // Add audit log
  await prisma.auditLog.create({
    data: {
      adminUserId: user.id,
      platformId: user.platformId,
      action: 'ADMIN_LOGIN',
      entity: 'AdminUser',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
    }
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        platformId: user.platformId,
      },
      token,
    },
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  
  res.status(200).json({
    success: true,
    message: 'Current user retrieved',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        platformId: user.platformId,
      }
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: 'Logout successful',
    data: null,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid input data';
    return next(new ApiError(400, errorMsg));
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = req.user;

  if (!user || !user.id) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  // Fetch user with passwordHash
  const dbUser = await prisma.adminUser.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    return next(new ApiError(404, 'User not found'));
  }

  const isMatch = await verifyPassword(dbUser.passwordHash, currentPassword);
  if (!isMatch) {
    return next(new ApiError(400, 'Current password is incorrect'));
  }

  if (currentPassword === newPassword) {
    return next(new ApiError(400, 'New password must be different from current password'));
  }

  const newHash = await hashPassword(newPassword);

  await prisma.adminUser.update({
    where: { id: dbUser.id },
    data: { passwordHash: newHash },
  });

  // Log password change event
  await prisma.auditLog.create({
    data: {
      adminUserId: dbUser.id,
      platformId: dbUser.platformId,
      action: 'ADMIN_PASSWORD_CHANGE',
      entity: 'AdminUser',
      entityId: dbUser.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
    },
  });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});
