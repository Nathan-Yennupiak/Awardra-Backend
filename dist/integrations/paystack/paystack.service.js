"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = void 0;
const env_1 = require("../../config/env");
const crypto_1 = __importDefault(require("crypto"));
class PaystackService {
    static baseUrl = 'https://api.paystack.co';
    static async initializePayment(params) {
        const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env_1.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: params.email,
                amount: params.amount,
                reference: params.reference,
                currency: params.currency || 'GHS',
                metadata: params.metadata,
                callback_url: params.callback_url
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to initialize Paystack payment');
        }
        return data.data; // { authorization_url, access_code, reference }
    }
    static async verifyPayment(reference) {
        const response = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${env_1.env.PAYSTACK_SECRET_KEY}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to verify Paystack payment');
        }
        return data.data;
    }
    static verifySignature(payload, signature) {
        if (!signature || typeof signature !== 'string')
            return false;
        const hash = crypto_1.default
            .createHmac('sha512', env_1.env.PAYSTACK_WEBHOOK_SECRET || env_1.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(payload))
            .digest('hex');
        const hashBuffer = Buffer.from(hash, 'utf8');
        const signatureBuffer = Buffer.from(signature, 'utf8');
        if (hashBuffer.length !== signatureBuffer.length) {
            return false;
        }
        return crypto_1.default.timingSafeEqual(hashBuffer, signatureBuffer);
    }
}
exports.PaystackService = PaystackService;
