/**
 * src/database/prisma/seed-export-accounts.ts
 *
 * Liệt kê TOÀN BỘ tài khoản đang có trong DB (email, tên, role, shop...) và xuất ra CSV.
 * CHỈ ĐỌC — không ghi/xoá gì trong DB.
 *
 * Chạy:
 *   npx ts-node src/database/prisma/seed-export-accounts.ts
 *
 * Lưu ý: mật khẩu được lưu dạng bcrypt hash (một chiều) nên KHÔNG thể lấy lại bản gốc.
 * File CSV chứa thông tin cá nhân (email, SĐT) → xoá sau khi dùng, đừng commit lên git.
 */
import { PrismaClient, Role } from '@prisma/client';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

// Thứ tự hiển thị: admin → seller → seller chờ duyệt → buyer
const ROLE_ORDER: Record<Role, number> = {
  ADMIN: 0,
  SELLER: 1,
  PENDING_SELLER: 2,
  BUYER: 3,
};

/** Escape 1 ô CSV; chặn CSV-injection (ô bắt đầu bằng = + - @ bị Excel hiểu là công thức). */
function csvCell(v: unknown): string {
  let s =
    v === null || v === undefined
      ? ''
      : v instanceof Date
        ? v.toISOString()
        : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      email: true,
      username: true,
      name: true,
      phone: true,
      isVerified: true,
      isBanned: true,
      password: true, // chỉ để biết có/không — KHÔNG in hash ra
      createdAt: true,
      shop: { select: { name: true, status: true } },
    },
  });

  users.sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const rows = users.map((u) => ({
    role: u.role,
    email: u.email ?? '',
    username: u.username ?? '',
    name: u.name ?? '',
    phone: u.phone ?? '',
    shopName: u.shop?.name ?? '',
    shopStatus: u.shop?.status ?? '',
    isVerified: u.isVerified ? 'yes' : 'no',
    isBanned: u.isBanned ? 'yes' : 'no',
    hasPassword: u.password ? 'yes' : 'no (OAuth)',
    createdAt: u.createdAt,
  }));

  // 1. In ra console (gọn: chỉ vài cột chính)
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nTổng ${rows.length} tài khoản:`, counts, '\n');
  console.table(
    rows.map((r) => ({
      role: r.role,
      email: r.email,
      name: r.name,
      shop: r.shopName,
    })),
  );

  // 2. Xuất CSV đầy đủ (BOM để Excel đọc đúng tiếng Việt)
  const headers = Object.keys(rows[0] ?? {
    role: '', email: '', username: '', name: '', phone: '', shopName: '',
    shopStatus: '', isVerified: '', isBanned: '', hasPassword: '', createdAt: '',
  });
  const csv =
    '\uFEFF' +
    [
      headers.map(csvCell).join(','),
      ...rows.map((r) =>
        headers.map((h) => csvCell((r as Record<string, unknown>)[h])).join(','),
      ),
    ].join('\r\n');

  const file = resolve(
    process.cwd(),
    `accounts-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  writeFileSync(file, csv, 'utf8');
  console.log(`\n✅ Đã xuất CSV: ${file}`);
  console.log('⚠️  File chứa email/SĐT thật — xoá sau khi dùng, đừng commit lên git.');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });