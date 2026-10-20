"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_controller_1 = require("./payments.controller");
const router = (0, express_1.Router)();
// Webhook requires raw body or JSON string to verify signature accurately, 
// but since we used express.json() globally, we might need a custom parser for this route 
// or verifySignature must stringify the body consistently. For now, assuming standard JSON payload.
router.post('/paystack/webhook', payments_controller_1.paystackWebhook);
exports.default = router;
