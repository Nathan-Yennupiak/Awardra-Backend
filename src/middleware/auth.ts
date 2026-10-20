import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new ApiError(401, 'Not authorized to access this route'));
    }

    try {
      const decoded: any = verifyToken(token);
      
      const user = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
      });

      if (!user || user.status !== 'ACTIVE') {
        return next(new ApiError(401, 'User not found or inactive'));
      }

      req.user = user;
      next();
    } catch (err) {
      return next(new ApiError(401, 'Not authorized, token failed'));
    }
  } catch (error) {
    next(error);
  }
};

export const authorizeRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `User role ${req.user.role} is not authorized to access this route`));
    }
    
    next();
  };
};

export const requirePlatformAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ApiError(401, 'Not authenticated'));
  }

  // Super admins can access any platform endpoint, but context might require explicit platform ID
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (req.user.role === 'ADMIN') {
    // Check if they have a platformId assigned
    if (!req.user.platformId) {
      return next(new ApiError(403, 'Admin user has no assigned platform'));
    }
    // They are authorized for their own platform
    return next();
  }

  return next(new ApiError(403, 'Not authorized'));
};
