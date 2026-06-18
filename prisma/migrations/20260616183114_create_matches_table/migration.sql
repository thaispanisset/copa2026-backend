-- CreateTable
CREATE TABLE `matches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamAId` INTEGER NOT NULL,
    `teamBId` INTEGER NOT NULL,
    `goalsA` INTEGER NULL,
    `goalsB` INTEGER NULL,
    `matchDate` DATETIME(3) NOT NULL,
    `phase` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_teamAId_fkey` FOREIGN KEY (`teamAId`) REFERENCES `teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_teamBId_fkey` FOREIGN KEY (`teamBId`) REFERENCES `teams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
