"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const nominations_controller_1 = require("./nominations.controller");
const router = (0, express_1.Router)();
// Protect nomination creation and verification against automated bot spamming
const nominationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Max 20 attempts per minute per IP
    message: { success: false, message: 'Too many nomination requests. Please wait a moment before trying again.' },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/initialize', nominationLimiter, nominations_controller_1.initializeNomination);
router.get('/verify/:reference', nominationLimiter, nominations_controller_1.verifyNomination);
exports.default = router;
