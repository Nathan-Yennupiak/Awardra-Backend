import { Router } from 'express';
import { paystackWebhook } from './payments.controller';

const router = Router();

// The signature is checked against req.rawBody, captured by the JSON parser in app.ts.
router.post('/paystack/webhook', paystackWebhook);

export default router;
