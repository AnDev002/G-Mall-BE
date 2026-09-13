-- Wiki 0094: Shop.businessType ('personal' | 'company').
-- RegisterSellerDto đã có field này từ 07/07 nhưng KHÔNG được lưu vì Shop thiếu cột
-- -> admin duyệt hồ sơ seller không thấy loại hình kinh doanh.
--
-- LƯU Ý DEPLOY (bài học wiki 0092): prod migrate bằng ALTER thủ công (VPS OOM không chạy
-- được `prisma migrate`). PHẢI chạy ALTER này TRƯỚC khi deploy dist mới, nếu không
-- `shop.create`/`findMany` sẽ ném Prisma P2022 -> 500 (đúng vết xe đổ BlogCategory.sortOrder).
ALTER TABLE `Shop` ADD COLUMN `businessType` VARCHAR(191) NULL;
