"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.logout = exports.getMe = exports.login = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const hash_1 = require("../../utils/hash");
const jwt_1 = require("../../utils/jwt");
const ApiError_1 = require("../../utils/ApiError");
const asyncHandler_1 = require("../../utils/asyncHandler");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return next(new ApiError_1.ApiError(400, 'Invalid request data'));
    }
    const { email, password } = parsed.data;
    const user = await database_1.prisma.adminUser.findUnique({
        where: { email },
    });
    if (!user || user.status !== 'ACTIVE') {
        return next(new ApiError_1.ApiError(401, 'Invalid credentials'));
    }
    const isMatch = await (0, hash_1.verifyPassword)(user.passwordHash, password);
    if (!isMatch) {
        return next(new ApiError_1.ApiError(401, 'Invalid credentials'));
    }
    const token = (0, jwt_1.generateToken)({ id: user.id, role: user.role });
    // Add audit log
    await database_1.prisma.auditLog.create({
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
exports.getMe = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
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
exports.logout = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    res.status(200).json({
        success: true,
        message: 'Logout successful',
        data: null,
    });
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters long'),
});
exports.changePassword = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid input data';
        return next(new ApiError_1.ApiError(400, errorMsg));
    }
    const { currentPassword, newPassword } = parsed.data;
    const user = req.user;
    if (!user || !user.id) {
        return next(new ApiError_1.ApiError(401, 'Unauthorized'));
    }
    // Fetch user with passwordHash
    const dbUser = await database_1.prisma.adminUser.findUnique({
        where: { id: user.id },
    });
    if (!dbUser) {
        return next(new ApiError_1.ApiError(404, 'User not found'));
    }
    const isMatch = await (0, hash_1.verifyPassword)(dbUser.passwordHash, currentPassword);
    if (!isMatch) {
        return next(new ApiError_1.ApiError(400, 'Current password is incorrect'));
    }
    if (currentPassword === newPassword) {
        return next(new ApiError_1.ApiError(400, 'New password must be different from current password'));
    }
    const newHash = await (0, hash_1.hashPassword)(newPassword);
    await database_1.prisma.adminUser.update({
        where: { id: dbUser.id },
        data: { passwordHash: newHash },
    });
    // Log password change event
    await database_1.prisma.auditLog.create({
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
