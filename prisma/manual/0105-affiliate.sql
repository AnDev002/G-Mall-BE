-- ============================================================================
-- wiki 0105 — Affiliate sản phẩm. SQL áp thủ công lên PROD.
--
-- VÌ SAO LÀ FILE SQL RỜI CHỨ KHÔNG PHẢI PRISMA MIGRATION:
--   `prisma/migrations/` của dự án là LỊCH SỬ CHẾT — `prisma migrate status`
--   báo cả 14 migration đều chưa áp dụng, và `migrate dev` gãy ở
--   `20251126072314_add_product_image_table` (viết `product` thường nên shadow
--   DB phân biệt hoa/thường không nuốt; migration đó còn xoá `Product.images`
--   trong khi schema hiện tại vẫn dùng cột này — tức nó đã bị bỏ dở).
--   Script dựng DB test (`qa-test-suite/scripts/setup-db.mjs`) cũng đã ghi rõ
--   lý do dùng `db push` thay `migrate deploy`.
--   → Dev/test đồng bộ bằng `npx prisma db push`; prod áp file này.
--
-- SINH RA BẰNG (chỉ lấy DELTA của affiliate, không lẫn drift sẵn có của DB dev):
--   npx prisma migrate diff \
--     --from-schema-datamodel <schema trước khi thêm affiliate> \
--     --to-schema-datamodel prisma/schema.prisma --script
--
-- KIỂM TRƯỚC KHI CHẠY TRÊN PROD:
--   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
--     --to-schema-datamodel prisma/schema.prisma --script
--   (xem prod còn lệch gì khác — xem wiki 0092 về drift vô hình với test)
--
-- AN TOÀN: toàn bộ là CREATE TABLE mới + ADD COLUMN có DEFAULT + mở rộng ENUM.
--   Không DROP, không đổi kiểu cột đang có dữ liệu → không mất dữ liệu.
-- ============================================================================

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `affiliateEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `affiliateRate` DECIMAL(6, 4) NULL;

-- AlterTable
ALTER TABLE `WalletTransaction` MODIFY `type` ENUM('ORDER_INCOME', 'PAYOUT', 'REFUND', 'FEE', 'AFFILIATE_COMMISSION', 'AFFILIATE_FEE') NOT NULL;

-- CreateTable
CREATE TABLE `AffiliateAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `channel` TEXT NULL,
    `note` TEXT NULL,
    `rejectReason` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `totalClicks` INTEGER NOT NULL DEFAULT 0,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AffiliateAccount_userId_key`(`userId`),
    UNIQUE INDEX `AffiliateAccount_code_key`(`code`),
    INDEX `AffiliateAccount_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateLink` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AffiliateLink_code_key`(`code`),
    INDEX `AffiliateLink_productId_idx`(`productId`),
    INDEX `AffiliateLink_shopId_idx`(`shopId`),
    UNIQUE INDEX `AffiliateLink_accountId_productId_key`(`accountId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateClick` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `clientIp` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `viewerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AffiliateClick_linkId_createdAt_idx`(`linkId`, `createdAt`),
    INDEX `AffiliateClick_clientIp_createdAt_idx`(`clientIp`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateCommission` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NULL,
    `sellerId` VARCHAR(191) NULL,
    `baseAmount` DECIMAL(15, 2) NOT NULL,
    `rate` DECIMAL(6, 4) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'SETTLED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectReason` VARCHAR(191) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `settlementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AffiliateCommission_orderItemId_key`(`orderItemId`),
    INDEX `AffiliateCommission_accountId_status_idx`(`accountId`, `status`),
    INDEX `AffiliateCommission_orderId_idx`(`orderId`),
    INDEX `AffiliateCommission_status_deliveredAt_idx`(`status`, `deliveredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateSettlement` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `itemCount` INTEGER NOT NULL,
    `settledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AffiliateSettlement_period_idx`(`period`),
    UNIQUE INDEX `AffiliateSettlement_accountId_period_key`(`accountId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Product_affiliateEnabled_idx` ON `Product`(`affiliateEnabled`);

-- AddForeignKey
ALTER TABLE `AffiliateAccount` ADD CONSTRAINT `AffiliateAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateLink` ADD CONSTRAINT `AffiliateLink_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AffiliateAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateLink` ADD CONSTRAINT `AffiliateLink_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateClick` ADD CONSTRAINT `AffiliateClick_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `AffiliateLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateCommission` ADD CONSTRAINT `AffiliateCommission_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AffiliateAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateCommission` ADD CONSTRAINT `AffiliateCommission_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `AffiliateLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateCommission` ADD CONSTRAINT `AffiliateCommission_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `AffiliateSettlement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AffiliateSettlement` ADD CONSTRAINT `AffiliateSettlement_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `AffiliateAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

