"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const env_1 = require("../../config/env");
const auth_1 = require("../../middleware/auth");
const admin_controller_1 = require("./admin.controller");
const router = (0, express_1.Router)();
cloudinary_1.v2.config({
    cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
    api_key: env_1.env.CLOUDINARY_API_KEY,
    api_secret: env_1.env.CLOUDINARY_API_SECRET,
});
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: async (req, file) => {
        return {
            folder: 'awards-platform',
            format: 'png', // or omit to auto-detect
            public_id: Date.now() + '-' + Math.round(Math.random() * 1e9),
        };
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB maximum file size
    },
    fileFilter: (req, file, cb) => {
        // Only allow verified image mimetypes
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
        }
    },
});
router.use(auth_1.authenticate, (0, auth_1.authorizeRole)('ADMIN', 'SUPER_ADMIN'), auth_1.requirePlatformAccess);
router.post('/upload', upload.single('image'), admin_controller_1.uploadImage);
router.get('/dashboard', admin_controller_1.getDashboard);
router.get('/awards', admin_controller_1.getAwards);
router.post('/awards', admin_controller_1.createAward);
router.put('/awards/:id', admin_controller_1.updateAward);
router.delete('/awards/:id', admin_controller_1.deleteAward);
router.get('/reports/overview', admin_controller_1.getReports);
router.get('/candidates', admin_controller_1.getCandidates);
router.post('/candidates', admin_controller_1.createCandidate);
router.put('/candidates/:id', admin_controller_1.updateCandidate);
router.delete('/candidates/:id', admin_controller_1.deleteCandidate);
router.get('/categories', admin_controller_1.getCategories);
router.post('/categories', admin_controller_1.createCategory);
router.put('/categories/:id', admin_controller_1.updateCategory);
router.delete('/categories/:id', admin_controller_1.deleteCategory);
exports.default = router;
