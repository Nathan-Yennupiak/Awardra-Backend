import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { env } from '../../config/env';
import { authenticate, authorizeRole, requirePlatformAccess } from '../../middleware/auth';
import { 
  getDashboard, 
  getAwards, 
  createAward, 
  updateAward, 
  deleteAward,
  getReports, 
  getCandidates, 
  createCandidate, 
  updateCandidate, 
  deleteCandidate,
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory,
  uploadImage 
} from './admin.controller';

const router = Router();

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'awards-platform',
      format: 'png', // or omit to auto-detect
      public_id: Date.now() + '-' + Math.round(Math.random() * 1e9),
    };
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum file size
  },
  fileFilter: (req, file, cb) => {
    // Only allow verified image mimetypes
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
    }
  },
});

router.use(authenticate, authorizeRole('ADMIN', 'SUPER_ADMIN'), requirePlatformAccess);

router.post('/upload', upload.single('image'), uploadImage);

router.get('/dashboard', getDashboard);
router.get('/awards', getAwards);
router.post('/awards', createAward);
router.put('/awards/:id', updateAward);
router.delete('/awards/:id', deleteAward);
router.get('/reports/overview', getReports);

router.get('/candidates', getCandidates);
router.post('/candidates', createCandidate);
router.put('/candidates/:id', updateCandidate);
router.delete('/candidates/:id', deleteCandidate);

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

export default router;
