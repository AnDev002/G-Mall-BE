-- CreateTable
CREATE TABLE `ProductCrossSell` (
    `productId` VARCHAR(191) NOT NULL,
    `relatedProductId` VARCHAR(191) NOT NULL,

    INDEX `ProductCrossSell_productId_idx`(`productId`),
    PRIMARY KEY (`productId`, `relatedProductId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductCrossSell` ADD CONSTRAINT `ProductCrossSell_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductCrossSell` ADD CONSTRAINT `ProductCrossSell_relatedProductId_fkey` FOREIGN KEY (`relatedProductId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
