/*
  Warnings:

  - You are about to drop the column `createdAt` on the `matches` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `matches` DROP FOREIGN KEY `matches_teamAId_fkey`;

-- DropForeignKey
ALTER TABLE `matches` DROP FOREIGN KEY `matches_teamBId_fkey`;

-- DropIndex
DROP INDEX `matches_teamAId_fkey` ON `matches`;

-- DropIndex
DROP INDEX `matches_teamBId_fkey` ON `matches`;

-- AlterTable
ALTER TABLE `matches` DROP COLUMN `createdAt`,
    ADD COLUMN `nextMatchId` INTEGER NULL,
    ADD COLUMN `nextMatchTeamPlace` VARCHAR(191) NULL,
    MODIFY `teamAId` INTEGER NULL,
    MODIFY `teamBId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_teamAId_fkey` FOREIGN KEY (`teamAId`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_teamBId_fkey` FOREIGN KEY (`teamBId`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
