import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { FinancialCalculationService } from '../../services/financial.service';
import { PaystackService } from '../../integrations/paystack/paystack.service';
import crypto from 'crypto';

const initializeSchema = z.object({
  awardCandidateId: z.string().uuid(),
  email: z.string().email(),
  callbackUrl: z.string().url().optional(),
  votes: z.number().int().min(1).optional().default(1),
});

export const initializeNomination = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = initializeSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new ApiError(400, 'Invalid request data'));
  }

  const { awardCandidateId, email, callbackUrl, votes } = parsed.data;

  // Verify award/candidate status
  const awardCandidate = await prisma.awardCandidate.findUnique({
    where: { id: awardCandidateId },
    include: {
      award: {
        include: { platform: { include: { settings: true } } }
      },
      candidate: true,
      category: true
    }
  });

  if (!awardCandidate) return next(new ApiError(404, 'Candidate assignment not found'));

  const award = awardCandidate.award;
  if (award.status !== 'PUBLISHED') return next(new ApiError(400, 'Award is not currently published'));
  if (awardCandidate.status !== 'ACTIVE' || awardCandidate.candidate.status !== 'ACTIVE') {
    return next(new ApiError(400, 'Candidate is not active'));
  }

  const now = new Date();
  if (award.startsAt && award.startsAt > now) return next(new ApiError(400, 'Nomination period has not started'));
  if (award.endsAt && award.endsAt < now) return next(new ApiError(400, 'Nomination period has ended'));

  // Determine fees
  const platformSettings = award.platform.settings;
  const singleBaseAmount = award.nominationFee || platformSettings?.nominationFee || 10000;
  const baseAmount = singleBaseAmount * votes;
  const paystackFeePercentage = Number(platformSettings?.paystackFeePercentage || 1.95);
  const creatorFeePercentage = Number(platformSettings?.creatorFeePercentage || 5.00);

  // Financial calculations
  const financials = FinancialCalculationService.calculate(
    baseAmount, 
    paystackFeePercentage, 
    creatorFeePercentage
  );

  // Create unique reference
  const reference = `NOM-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const paystackReference = crypto.randomBytes(8).toString('hex').toUpperCase();

  // Use a transaction
  const [nomination, payment] = await prisma.$transaction(async (tx: any) => {
    const nom = await tx.nomination.create({
      data: {
        awardCandidateId,
        nominatorEmail: email,
        reference,
        status: 'PENDING',
        votes
      }
    });

    const pay = await tx.paymentTransaction.create({
      data: {
        nominationId: nom.id,
        paystackReference,
        baseAmount: financials.baseAmount,
        paystackFee: financials.paystackFee,
        paystackFeePercentage: financials.paystackFeePercentage,
        creatorFee: financials.creatorFee,
        creatorFeePercentage: financials.creatorFeePercentage,
        customerPays: financials.customerPays,
        ownerNet: financials.ownerNet,
        currency: financials.currency,
        status: 'INITIALIZED'
      }
    });

    await tx.nomination.update({
      where: { id: nom.id },
      data: { paymentTransactionId: pay.id }
    });

    return [nom, pay];
  });

  try {
    const paystackData = await PaystackService.initializePayment({
      amount: financials.customerPays,
      email,
      reference: paystackReference,
      currency: financials.currency,
      callback_url: callbackUrl,
      metadata: {
        nominationReference: reference,
        awardCandidateId,
      }
    });

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { status: 'PENDING' }
    });

    res.status(200).json({
      success: true,
      data: {
        reference,
        authorizationUrl: paystackData.authorization_url,
        financials: {
          customerPays: financials.customerPays,
          currency: financials.currency
        }
      }
    });
  } catch (error: any) {
    // If Paystack fails, mark as failed safely
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { status: 'FAILED', gatewayResponse: error.message }
    });
    
    await prisma.nomination.update({
      where: { id: nomination.id },
      data: { status: 'FAILED' }
    });

    return next(new ApiError(500, 'Failed to initialize payment gateway'));
  }
});

export const verifyNomination = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const reference = req.params.reference as string;
  if (!reference) return next(new ApiError(400, 'Reference is required'));

  const transaction: any = await prisma.paymentTransaction.findUnique({
    where: { paystackReference: reference },
    include: { nomination: true }
  });

  if (!transaction) return next(new ApiError(404, 'Transaction not found'));

  // If already processed via webhook, just return success
  if (transaction.status === 'SUCCESS' || transaction.nomination?.status === 'CONFIRMED') {
    return res.status(200).json({ success: true, message: 'Payment already verified' });
  }

  try {
    const paystackData = await PaystackService.verifyPayment(reference as string);

    if (paystackData.status === 'success') {
      // Verify amount and currency
      if (transaction.customerPays !== paystackData.amount || transaction.currency !== paystackData.currency) {
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED', gatewayResponse: 'Amount or currency mismatch' }
        });
        await prisma.nomination.update({
          where: { id: transaction.nominationId },
          data: { status: 'FAILED' }
        });
        return next(new ApiError(400, 'Amount or currency mismatch'));
      }

      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'SUCCESS',
            channel: paystackData.channel,
            gatewayResponse: paystackData.gateway_response,
            paidAt: new Date(paystackData.paidAt || paystackData.paid_at || new Date()),
            verifiedAt: new Date()
          }
        });

        await tx.nomination.update({
          where: { id: transaction.nominationId },
          data: { status: 'CONFIRMED', confirmedAt: new Date() }
        });
      });

      return res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      return res.status(400).json({ success: false, message: 'Payment not successful' });
    }
  } catch (error: any) {
    return next(new ApiError(500, error.message || 'Failed to verify payment'));
  }
});
