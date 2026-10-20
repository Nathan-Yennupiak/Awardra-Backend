import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { initializeNomination, verifyNomination } from './nominations.controller';

const router = Router();

// Protect nomination creation and verification against automated bot spamming
const nominationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Max 20 attempts per minute per IP
  message: { success: false, message: 'Too many nomination requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/initialize', nominationLimiter, initializeNomination);
router.get('/verify/:reference', nominationLimiter, verifyNomination);

export default router;
