/*
  Warnings:

  - You are about to drop the column `shippingAddress` on the `order` table. All the data in the column will be lost.
  - You are about to alter the column `totalAmount` on the `order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Decimal(65,30)`.
  - You are about to drop the column `selectedOptions` on the `orderitem` table. All the data in the column will be lost.
  - Added the required column `paymentMethod` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `order` DROP COLUMN `shippingAddress`,
    ADD COLUMN `isGift` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `message` VARCHAR(191) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NOT NULL,
    ADD COLUMN `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN `recipientAddress` VARCHAR(191) NULL,
    ADD COLUMN `recipientName` VARCHAR(191) NULL,
    ADD COLUMN `recipientPhone` VARCHAR(191) NULL,
    ADD COLUMN `shippingFee` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    MODIFY `totalAmount` DECIMAL(65, 30) NOT NULL;

-- AlterTable
ALTER TABLE `orderitem` DROP COLUMN `selectedOptions`;

-- CreateTable
CREATE TABLE `AnalyticsLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalyticsLog_userId_idx`(`userId`),
    INDEX `AnalyticsLog_eventType_idx`(`eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
