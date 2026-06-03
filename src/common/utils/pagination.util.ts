// common/utils/pagination.util.ts
// Wiki 0074: clamp phân trang tập trung.
//
// Bug gốc: nhiều endpoint nhận page/limit từ query (string) rồi tính
//   skip = (page - 1) * limit
// và đưa thẳng vào Prisma. Khi page < 1 (vd ?page=-1) → skip ÂM →
// Prisma ném "Invalid value for skip" → HTTP 500 (crash). Mẫu `Number(x) || 1`
// KHÔNG cứu được vì -1 là truthy (chỉ chặn 0/NaN).
//
// Helper này clamp page ≥ 1 và limit trong [1, maxLimit] (chặn trên tránh
// `take` quá lớn gây DoS/cạn RAM), trả về cả skip đã tính sẵn.

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(
  page?: number | string | null,
  limit?: number | string | null,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): Pagination {
  const { defaultLimit = 10, maxLimit = 100 } = opts;
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const l = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit)) || defaultLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}
