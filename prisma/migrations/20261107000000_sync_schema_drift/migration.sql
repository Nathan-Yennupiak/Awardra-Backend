-- Brings the migration history in line with schema.prisma.
--
-- Several columns were previously added outside of migrations (add-column.js,
-- add-votes-column.js, `prisma db push`). IF NOT EXISTS makes this migration safe
-- to run both on a fresh database and on one that already has those columns.

-- AlterTable: columns that were added out-of-band
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "plainPassword" TEXT;
ALTER TABLE "Nomination" ADD COLUMN IF NOT EXISTS "nominatorEmail" TEXT;
ALTER TABLE "Nomination" ADD COLUMN IF NOT EXISTS "votes" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: startsAt / endsAt are required in the schema
UPDATE "Award" SET "startsAt" = "createdAt" WHERE "startsAt" IS NULL;
UPDATE "Award" SET "endsAt" = "createdAt" + INTERVAL '1 year' WHERE "endsAt" IS NULL;
ALTER TABLE "Award" ALTER COLUMN "startsAt" SET NOT NULL,
                    ALTER COLUMN "endsAt" SET NOT NULL;

-- Award slugs become globally unique, because public URLs are /awards/:slug.
-- Any existing duplicates (across platforms) keep the oldest award's slug; later
-- ones get a short suffix from their id.
UPDATE "Award" a
SET "slug" = a."slug" || '-' || substr(a."id", 1, 6)
WHERE EXISTS (
  SELECT 1 FROM "Award" b
  WHERE b."slug" = a."slug"
    AND (b."createdAt" < a."createdAt" OR (b."createdAt" = a."createdAt" AND b."id" < a."id"))
);

DROP INDEX IF EXISTS "Award_platformId_slug_key";
CREATE UNIQUE INDEX "Award_slug_key" ON "Award"("slug");
CREATE INDEX "Award_platformId_idx" ON "Award"("platformId");

-- CreateIndex: supports the pending-nomination expiry job
CREATE INDEX "Nomination_status_createdAt_idx" ON "Nomination"("status", "createdAt");
