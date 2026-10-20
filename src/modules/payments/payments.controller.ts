import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { PaystackService } from '../../integrations/paystack/paystack.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const paystackWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string;
  
  if (!signature) {
    return res.status(400).send('Signature missing');
  }

  const isValid = PaystackService.verifySignature(req.body, signature);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  // We only care about successful payments for now
  if (event.event === 'charge.success') {
    const data = event.data;
    const paystackReference = data.reference;

    // Acknowledge receipt immediately to Paystack
    res.status(200).send('OK');

    try {
      // Process inside transaction for idempotency and atomicity
      await prisma.$transaction(async (tx: any) => {
        const transaction = await tx.paymentTransaction.findUnique({
          where: { paystackReference },
          include: { nomination: true }
        });

        if (!transaction) {
          console.error(`Webhook error: Transaction not found for ref ${paystackReference}`);
          return;
        }

        // Idempotency check: If already processed, do nothing
        if (transaction.status === 'SUCCESS' || transaction.nomination.status === 'CONFIRMED') {
          return;
        }

        // Verify amount and currency
        // Paystack amount is in kobo/pesewas
        if (transaction.customerPays !== data.amount || transaction.currency !== data.currency) {
          console.error(`Webhook error: Amount/Currency mismatch for ref ${paystackReference}`);
          
          await tx.paymentTransaction.update({
            where: { id: transaction.id },
            data: { 
              status: 'FAILED', 
              gatewayResponse: 'Amount or currency mismatch' 
            }
          });
          
          await tx.nomination.update({
            where: { id: transaction.nomination.id },
            data: { status: 'FAILED' }
          });
          return;
        }

        // Mark payment successful
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'SUCCESS',
            channel: data.channel,
            gatewayResponse: data.gateway_response,
            paidAt: new Date(data.paidAt || data.paid_at || new Date()),
            verifiedAt: new Date()
          }
        });

        // Mark nomination confirmed
        await tx.nomination.update({
          where: { id: transaction.nomination.id },
          data: { 
            status: 'CONFIRMED',
            confirmedAt: new Date()
          }
        });
        
        console.log(`Payment confirmed for nomination ${transaction.nomination.reference}`);
      });
    } catch (error) {
      console.error('Error processing webhook event', error);
      // We already returned 200 OK to Paystack
    }
  } else {
    // Other events
    res.status(200).send('OK');
  }
});
