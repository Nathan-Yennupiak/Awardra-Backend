export class FinancialCalculationService {
  /**
   * Calculates all financial values for a nomination
   * 
   * @param baseAmount - The base nomination fee in minor units (e.g. pesewas)
   * @param paystackFeePercentage - The percentage fee charged by Paystack (e.g. 1.95)
   * @param creatorFeePercentage - The percentage fee charged by the platform creator (e.g. 5)
   * @returns Object containing all calculated amounts in minor units
   */
  static calculate(baseAmount: number, paystackFeePercentage: number, creatorFeePercentage: number) {
    // Creator fee is calculated on the base amount
    const creatorFee = Math.round((baseAmount * creatorFeePercentage) / 100);
    
    // Owner gets base minus creator fee
    const ownerNet = baseAmount - creatorFee;

    // The amount the customer pays must cover the base amount + paystack fee
    // customerPays = baseAmount / (1 - (paystackFeePercentage / 100))
    // To avoid floating point issues, we do this carefully
    const r = paystackFeePercentage / 100;
    const customerPays = Math.round(baseAmount / (1 - r));
    
    const paystackFee = customerPays - baseAmount;

    return {
      baseAmount,
      paystackFeePercentage,
      creatorFeePercentage,
      creatorFee,
      ownerNet,
      customerPays,
      paystackFee,
      currency: 'GHS'
    };
  }
}
