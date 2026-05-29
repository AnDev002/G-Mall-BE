-- wiki 0052: image search — metadata index trong MySQL, vector trong Qdrant.

-- CreateTable
CREATE TABLE `ProductEmbedding` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'INDEXED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `imageHash` VARCHAR(64) NULL,
    `model` VARCHAR(191) NOT NULL DEFAULT 'clip-ViT-B-32-multilingual-v1',
    `errorMsg` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `indexedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProductEmbedding_productId_key`(`productId`),
    INDEX `ProductEmbedding_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductEmbedding` ADD CONSTRAINT `ProductEmbedding_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
