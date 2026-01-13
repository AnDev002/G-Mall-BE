-- AlterTable
ALTER TABLE `voucher` MODIFY `scope` ENUM('GLOBAL', 'SHOP', 'PRODUCT', 'CATEGORY') NOT NULL;

-- CreateTable
CREATE TABLE `_CategoryToVoucher` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_CategoryToVoucher_AB_unique`(`A`, `B`),
    INDEX `_CategoryToVoucher_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_CategoryToVoucher` ADD CONSTRAINT `_CategoryToVoucher_A_fkey` FOREIGN KEY (`A`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CategoryToVoucher` ADD CONSTRAINT `_CategoryToVoucher_B_fkey` FOREIGN KEY (`B`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
