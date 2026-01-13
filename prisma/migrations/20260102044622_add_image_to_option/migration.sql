-- DropForeignKey
ALTER TABLE `productoptionvalue` DROP FOREIGN KEY `ProductOptionValue_optionId_fkey`;

-- AlterTable
ALTER TABLE `productoptionvalue` ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE `ProductOptionValue` ADD CONSTRAINT `ProductOptionValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `ProductOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `productoptionvalue` RENAME INDEX `ProductOptionValue_optionId_fkey` TO `ProductOptionValue_optionId_idx`;
