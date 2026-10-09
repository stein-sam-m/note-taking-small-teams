-- CreateTable
CREATE TABLE "ClearanceLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    CONSTRAINT "ClearanceLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClearanceLevel_name_key" ON "ClearanceLevel"("name");
CREATE UNIQUE INDEX "ClearanceLevel_rank_key" ON "ClearanceLevel"("rank");

-- Seed the four levels
INSERT INTO "ClearanceLevel" ("id", "name", "rank") VALUES
    (gen_random_uuid()::text, 'none', 1),
    (gen_random_uuid()::text, 'secret', 2),
    (gen_random_uuid()::text, 'top_secret', 3),
    (gen_random_uuid()::text, 'polygraph', 4);

-- Add clearanceLevelId as nullable first (allows backfill before enforcing NOT NULL)
ALTER TABLE "User" ADD COLUMN "clearanceLevelId" TEXT;
ALTER TABLE "Note" ADD COLUMN "clearanceLevelId" TEXT;

-- Backfill all existing rows to 'none'
UPDATE "User" SET "clearanceLevelId" = (SELECT "id" FROM "ClearanceLevel" WHERE "name" = 'none');
UPDATE "Note" SET "clearanceLevelId" = (SELECT "id" FROM "ClearanceLevel" WHERE "name" = 'none');

-- Enforce NOT NULL
ALTER TABLE "User" ALTER COLUMN "clearanceLevelId" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "clearanceLevelId" SET NOT NULL;

-- Add FK constraints
ALTER TABLE "User" ADD CONSTRAINT "User_clearanceLevelId_fkey"
    FOREIGN KEY ("clearanceLevelId") REFERENCES "ClearanceLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_clearanceLevelId_fkey"
    FOREIGN KEY ("clearanceLevelId") REFERENCES "ClearanceLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
