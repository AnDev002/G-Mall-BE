/**
 * src/database/prisma/seed-reset-passwords.ts
 *
 * Đặt lại mật khẩu của TOÀN BỘ tài khoản thành một mật khẩu chung (mặc định: lovegifts@2026).
 *
 * Chạy:
 *   npx ts-node src/database/prisma/seed-reset-passwords.ts             # DRY-RUN: chỉ đếm
 *   npx ts-node src/database/prisma/seed-reset-passwords.ts --confirm   # đặt lại thật
 *
 * Tuỳ chọn:
 *   --role=SELLER,BUYER     chỉ đổi các role này (vd bỏ qua ADMIN). Mặc định: tất cả role.
 *   NEW_PASSWORD=xxx        đổi mật khẩu bằng biến môi trường thay vì sửa file.
 *
 * Hành vi:
 *   - Hash bằng bcrypt cost 10 — giống auth.service.ts nên login() so sánh được bình thường.
 *   - Tăng tokenVersion (+1) cho từng user → mọi JWT/cookie đang đăng nhập bị vô hiệu,
 *     tất cả phải đăng nhập lại (đúng cơ chế changePassword/resetPassword trong auth.service).
 *   - Tài khoản OAuth (password = NULL) cũng được gán mật khẩu → đăng nhập được bằng email + mật khẩu này.
 *   - Tài khoản đang bị khoá (isBanned) vẫn bị khoá; script không đổi trạng thái này.
 *   - Một câu UPDATE duy nhất → hoặc đổi hết hoặc không đổi gì.
 *   - KHÔNG hoàn tác được (hash cũ bị ghi đè) → backup bảng User trước khi chạy --confirm.
 *
 * ⚠️  Mọi tài khoản (kể cả ADMIN) dùng chung 1 mật khẩu: chỉ dùng cho DB test/dev, hoặc đổi
 *     lại ngay sau khi test. Xoá file này khỏi server sau khi dùng.
 */
import { PrismaClient, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const NEW_PASSWORD = process.env.NEW_PASSWORD ?? 'lovegifts@2026';
const BCRYPT_ROUNDS = 10; // phải khớp bcrypt.hash(..., 10) trong auth.service.ts
const CONFIRM = process.argv.includes('--confirm');
const COUNTDOWN_SECONDS = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** In host/db đang trỏ tới (KHÔNG in password) để khỏi chạy nhầm DB production. */
function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return `${u.hostname}:${u.port || '3306'}${u.pathname}`;
  } catch {
    return '(không đọc được DATABASE_URL)';
  }
}

/** Đọc --role=A,B → Role[] (hoặc undefined = tất cả). Sai tên role thì dừng ngay. */
function parseRoles(): Role[] | undefined {
  const arg = process.argv.find((a) => a.startsWith('--role='));
  if (!arg) return undefined;
  const valid = Object.values(Role) as string[];
  const roles = arg
    .slice('--role='.length)
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  const bad = roles.filter((r) => !valid.includes(r));
  if (roles.length === 0 || bad.length > 0) {
    throw new Error(
      `--role không hợp lệ${bad.length ? `: ${bad.join(', ')}` : ''}. Hợp lệ: ${valid.join(', ')}`,
    );
  }
  return roles as Role[];
}

async function main() {
  const roles = parseRoles();
  const where: Prisma.UserWhereInput = roles ? { role: { in: roles } } : {};

  console.log('='.repeat(60));
  console.log(`Database : ${describeDatabase()}`);
  console.log(`Chế độ   : ${CONFIRM ? 'ĐẶT LẠI THẬT (--confirm)' : 'DRY-RUN (chỉ đếm, không đổi gì)'}`);
  console.log(`Phạm vi  : ${roles ? `role ${roles.join(', ')}` : 'TẤT CẢ role'}`);
  console.log('='.repeat(60));

  const [byRole, total, withoutPassword] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where, _count: { _all: true } }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, password: null } }),
  ]);

  if (total === 0) {
    console.log('\nKhông có tài khoản nào khớp phạm vi. Kết thúc.');
    return;
  }

  console.log('\nTài khoản sẽ bị đổi mật khẩu:');
  console.table(byRole.map((r) => ({ role: r.role, count: r._count._all })));
  console.log(`Tổng: ${total} (trong đó ${withoutPassword} tài khoản OAuth chưa có mật khẩu, sẽ được gán mới).`);
  console.log('Tất cả phiên đăng nhập hiện tại của các tài khoản này sẽ bị đăng xuất.');

  if (!CONFIRM) {
    console.log('\n[DRY-RUN] Chưa đổi gì. Backup bảng User rồi chạy lại với --confirm.');
    return;
  }

  console.log(`\n⚠️  Sẽ ĐẶT LẠI MẬT KHẨU ${total} tài khoản sau ${COUNTDOWN_SECONDS}s — Ctrl+C để huỷ...`);
  await sleep(COUNTDOWN_SECONDS * 1000);

  // Cùng một mật khẩu → hash 1 lần dùng cho tất cả (nhanh hơn hash 255 lần, kết quả hợp lệ như nhau).
  const hash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS);

  const { count } = await prisma.user.updateMany({
    where,
    data: { password: hash, tokenVersion: { increment: 1 } },
  });

  // Kiểm tra lại: lấy vài tài khoản và so sánh thử bằng đúng hàm login() dùng.
  const samples = await prisma.user.findMany({
    where,
    take: 3,
    select: { email: true, role: true, password: true },
  });
  for (const s of samples) {
    const ok = !!s.password && (await bcrypt.compare(NEW_PASSWORD, s.password));
    console.log(`  kiểm tra ${s.role.padEnd(14)} ${s.email ?? '(không email)'}: ${ok ? 'OK' : 'LỖI'}`);
  }

  console.log(`\n✅ Đã đặt lại mật khẩu cho ${count} tài khoản.`);
  console.log('   Nhớ xoá file seed này khỏi server sau khi dùng xong.');
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });