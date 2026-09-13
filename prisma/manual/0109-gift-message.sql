-- ============================================================================
-- wiki 0108 — Lời chúc của đơn quà tặng. SQL áp thủ công lên PROD.
--
-- VÌ SAO LÀ FILE SQL RỜI: xem đầu file 0105-affiliate.sql — `prisma/migrations/`
-- của dự án là lịch sử chết, dev/test đồng bộ bằng `prisma db push`, prod áp tay.
--
-- VẤN ĐỀ: `Order.message` được schema chú thích là "Lời chúc", nhưng code thực tế
-- ghi GHI CHÚ CHO SHOP vào đó (`message: note`, note lấy theo từng shop). Còn lời
-- chúc thật thì FE có gửi (`senderInfo.message`) mà BE không bao giờ đọc — nên trên
-- một sàn QUÀ TẶNG, lời chúc bị vứt đi 100%.
--
-- QUYẾT ĐỊNH: thêm cột RIÊNG thay vì tái dụng `message`. Hai thứ này cùng tồn tại
-- trong một đơn (khách vừa nhắn shop "giao giờ hành chính" vừa gửi lời chúc cho
-- người nhận), nên nhét chung một cột là mất một trong hai.
--
-- 500 ký tự: lời chúc dài hơn ghi chú giao hàng (191) nhưng vẫn có trần rõ ràng để
-- không lặp lại lỗi P2000 → 500.
--
-- AN TOÀN: cột NULL được, không ràng buộc, không đụng dữ liệu cũ. Chạy lại vô hại
-- nhờ khối kiểm tra bên dưới.
-- ============================================================================

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'giftMessage'
);

SET @sql := IF(@exists = 0,
  'ALTER TABLE `Order` ADD COLUMN `giftMessage` VARCHAR(500) NULL',
  'SELECT "giftMessage da ton tai, bo qua" AS ghi_chu'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
