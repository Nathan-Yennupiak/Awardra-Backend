import { describe, expect, it } from 'vitest';
import {
  FinancialCalculationService,
  resolvePaystackFeePercentage,
  DEFAULT_PAYSTACK_FEE_PERCENTAGE,
} from '../src/services/financial.service';

describe('FinancialCalculationService.calculate', () => {
  it('grosses up the Paystack fee and takes the creator fee from the base', () => {
    const result = FinancialCalculationService.calculate(10_000, 1.95, 5);

    expect(result.creatorFee).toBe(500);
    expect(result.ownerNet).toBe(9_500);
    expect(result.customerPays).toBe(Math.round(10_000 / (1 - 0.0195))); // 10199
    expect(result.paystackFee).toBe(result.customerPays - 10_000);
  });

  it('always works in whole minor units', () => {
    for (const base of [1, 99, 12_345, 1_000_000]) {
      const r = FinancialCalculationService.calculate(base, 1.95, 5);
      for (const value of [r.creatorFee, r.ownerNet, r.customerPays, r.paystackFee]) {
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(r.ownerNet + r.creatorFee).toBe(base);
      expect(r.baseAmount + r.paystackFee).toBe(r.customerPays);
    }
  });

  it('leaves the base untouched when both fees are zero', () => {
    const r = FinancialCalculationService.calculate(5_000, 0, 0);
    expect(r).toMatchObject({ customerPays: 5_000, paystackFee: 0, creatorFee: 0, ownerNet: 5_000 });
  });
});

describe('resolvePaystackFeePercentage', () => {
  it('uses the platform setting when present', () => {
    expect(resolvePaystackFeePercentage({ paystackFeePercentage: '2.5' })).toBe(2.5);
  });

  it('falls back to the default', () => {
    expect(resolvePaystackFeePercentage(null)).toBe(DEFAULT_PAYSTACK_FEE_PERCENTAGE);
    expect(resolvePaystackFeePercentage({})).toBe(DEFAULT_PAYSTACK_FEE_PERCENTAGE);
  });
});
