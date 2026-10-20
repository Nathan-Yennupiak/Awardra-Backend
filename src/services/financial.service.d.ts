export declare class FinancialCalculationService {
    /**
     * Calculates all financial values for a nomination
     *
     * @param baseAmount - The base nomination fee in minor units (e.g. pesewas)
     * @param paystackFeePercentage - The percentage fee charged by Paystack (e.g. 1.95)
     * @param creatorFeePercentage - The percentage fee charged by the platform creator (e.g. 5)
     * @returns Object containing all calculated amounts in minor units
     */
    static calculate(baseAmount: number, paystackFeePercentage: number, creatorFeePercentage: number): {
        baseAmount: number;
        paystackFeePercentage: number;
        creatorFeePercentage: number;
        creatorFee: number;
        ownerNet: number;
        customerPays: number;
        paystackFee: number;
        currency: string;
    };
}
//# sourceMappingURL=financial.service.d.ts.map