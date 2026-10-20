interface InitializePaymentParams {
    amount: number;
    email: string;
    reference: string;
    currency?: string;
    metadata?: any;
}
export declare class PaystackService {
    private static baseUrl;
    static initializePayment(params: InitializePaymentParams): Promise<any>;
    static verifySignature(payload: any, signature: string): boolean;
}
export {};
//# sourceMappingURL=paystack.service.d.ts.map