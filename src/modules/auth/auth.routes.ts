import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, getMe, logout, changePassword } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Strict rate limiting for login to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);

export default router;
