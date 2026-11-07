import { prisma } from '../config/database';

/**
 * How long a nomination may wait for payment. Generous because mobile-money and bank
 * payments can take a while to settle.
 */
export const PENDING_NOMINATION_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Marks nominations still PENDING after the TTL as EXPIRED and cancels their payment
 * transactions. If a payment for one of them does arrive later, the webhook and verify
 * endpoints still confirm it, because they only skip SUCCESS / CONFIRMED records.
 */
export async function expireStaleNominations(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PENDING_NOMINATION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const stale = await tx.nomination.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length === 0) return 0;

    const ids = stale.map((n) => n.id);

    // Status guards stop us overwriting anything a webhook confirmed in the meantime.
    await tx.paymentTransaction.updateMany({
      where: { nominationId: { in: ids }, status: { in: ['INITIALIZED', 'PENDING'] } },
      data: { status: 'CANCELLED', gatewayResponse: 'Expired: no payment received in time' },
    });
    const { count } = await tx.nomination.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    return count;
  });
}

/** Runs the sweep now and then periodically. Returns a function that stops it. */
export function startNominationExpiryJob(): () => void {
  const run = () =>
    expireStaleNominations()
      .then((count) => {
        if (count > 0) console.log(`⏱️  Expired ${count} unpaid nomination(s)`);
      })
      .catch((error) => console.error('Nomination expiry sweep failed', error));

  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
