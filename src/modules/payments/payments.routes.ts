import { Router, raw } from 'express';
import { paystackWebhook } from './payments.controller';

const router = Router();

// Webhook requires raw body or JSON string to verify signature accurately, 
// but since we used express.json() globally, we might need a custom parser for this route 
// or verifySignature must stringify the body consistently. For now, assuming standard JSON payload.
router.post('/paystack/webhook', paystackWebhook);

export default router;
