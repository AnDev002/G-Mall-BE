-- wiki 0111 — thêm index cho `Product.status`.
--
-- Vì sao: `status` là cột lọc của mọi màn duyệt sản phẩm, và từ nay còn bị đếm ở
-- `GET /admin/dashboard/pending-counts` mỗi lần admin đổi trang (badge "việc đang chờ").
-- Trước bản vá này `EXPLAIN SELECT COUNT(*) FROM Product WHERE status='PENDING'` cho
-- `type: ALL` — quét toàn bảng. Các bảng hàng đợi khác (Shop, AffiliateAccount,
-- PayoutRequest, Complaint) đều đã có index trên `status`; riêng Product thì không.
--
-- An toàn: bảng Product trên prod có ~941 dòng (đo 20/08/2026) nên ALTER chạy tức thì và
-- không khoá gì đáng kể. Chỉ THÊM index, không đụng dữ liệu — lùi lại được bằng DROP.
--
-- Chạy trên VPS:
--   mysql -uroot -p'<mat_khau>' 'gmall_ecommerce_db_1.0' < 0111-product-status-index.sql
--
-- Lùi lại:
--   ALTER TABLE `Product` DROP INDEX `Product_status_idx`;

-- MySQL không có "ADD INDEX IF NOT EXISTS", nên kiểm trước rồi mới thêm — chạy lại lần
-- hai sẽ không lỗi.
SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'Product'
    AND index_name = 'Product_status_idx'
);

SET @sql := IF(@exists = 0,
  'ALTER TABLE `Product` ADD INDEX `Product_status_idx` (`status`)',
  'SELECT ''Product_status_idx da ton tai, bo qua'' AS ghi_chu');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
