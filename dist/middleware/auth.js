"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlatformAccess = exports.authorizeRole = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const database_1 = require("../config/database");
const ApiError_1 = require("../utils/ApiError");
const authenticate = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next(new ApiError_1.ApiError(401, 'Not authorized to access this route'));
        }
        try {
            const decoded = (0, jwt_1.verifyToken)(token);
            const user = await database_1.prisma.adminUser.findUnique({
                where: { id: decoded.id },
            });
            if (!user || user.status !== 'ACTIVE') {
                return next(new ApiError_1.ApiError(401, 'User not found or inactive'));
            }
            req.user = user;
            next();
        }
        catch (err) {
            return next(new ApiError_1.ApiError(401, 'Not authorized, token failed'));
        }
    }
    catch (error) {
        next(error);
    }
};
exports.authenticate = authenticate;
const authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError_1.ApiError(401, 'Not authenticated'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new ApiError_1.ApiError(403, `User role ${req.user.role} is not authorized to access this route`));
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
const requirePlatformAccess = (req, res, next) => {
    if (!req.user) {
        return next(new ApiError_1.ApiError(401, 'Not authenticated'));
    }
    // Super admins can access any platform endpoint, but context might require explicit platform ID
    if (req.user.role === 'SUPER_ADMIN') {
        return next();
    }
    if (req.user.role === 'ADMIN') {
        // Check if they have a platformId assigned
        if (!req.user.platformId) {
            return next(new ApiError_1.ApiError(403, 'Admin user has no assigned platform'));
        }
        // They are authorized for their own platform
        return next();
    }
    return next(new ApiError_1.ApiError(403, 'Not authorized'));
};
exports.requirePlatformAccess = requirePlatformAccess;
