import { env } from '../../config/env';
import crypto from 'crypto';

interface InitializePaymentParams {
  amount: number;
  email: string;
  reference: string;
  currency?: string;
  metadata?: any;
  callback_url?: string;
}

export class PaystackService {
  private static baseUrl = 'https://api.paystack.co';

  static async initializePayment(params: InitializePaymentParams) {
    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
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

  static async verifyPayment(reference: string) {
    const response = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify Paystack payment');
    }

    return data.data;
  }

  static verifySignature(payload: any, signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;
    
    const hash = crypto
      .createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');

    const hashBuffer = Buffer.from(hash, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (hashBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
  }
}
