// BE/common/utils/sanitize.util.ts
// Dependency-free HTML sanitizer for blog content (Stored XSS defense).
// Không thêm npm package (sanitize-html/dompurify) — chỉ strip các vector nguy hiểm:
//   - thẻ <script> / <iframe> / <object> / <embed> (cả nội dung bên trong)
//   - thuộc tính event handler on* (onclick, onerror, onload, ...)
//   - URL scheme javascript: / vbscript: / data: trong href/src/style
// Mục tiêu là chặn thực thi JS, không phải làm trình parse HTML hoàn chỉnh.

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'noscript'];

/**
 * Làm sạch một chuỗi HTML (content/excerpt của blog).
 * Trả về '' nếu input rỗng/không phải string.
 */
export function sanitizeHtml(input?: string | null): string {
  if (!input || typeof input !== 'string') return input ?? '';

  let html = input;

  // 1. Xóa các thẻ nguy hiểm kèm nội dung: <script>...</script>, <iframe ...>...</iframe>
  for (const tag of DANGEROUS_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    html = html.replace(paired, '');
    // Phòng trường hợp thẻ tự đóng / không có thẻ đóng tương ứng
    const orphan = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    html = html.replace(orphan, '');
  }

  // 2. Xóa các thuộc tính event handler on* (vd: onclick="...", onerror='...', onload=foo)
  //    Wiki 0086: bắt cả dấu phân tách là SLASH, không chỉ whitespace — chặn bypass kiểu
  //    <svg/onload=alert(1)> / <img/src=x/onerror=...> (trước đây chỉ match \son... nên lọt).
  html = html.replace(/[\s/]on[a-z]+\s*=\s*"[^"]*"/gi, ' ');
  html = html.replace(/[\s/]on[a-z]+\s*=\s*'[^']*'/gi, ' ');
  html = html.replace(/[\s/]on[a-z]+\s*=\s*[^\s>]+/gi, ' ');

  // 3. Vô hiệu hóa URL scheme nguy hiểm trong href/src (javascript:, vbscript:, data:)
  //    Chỉ áp dụng cho giá trị nằm trong dấu nháy của thuộc tính.
  html = html.replace(
    /((?:href|src)\s*=\s*)("|')\s*(?:javascript|vbscript|data)\s*:[^"']*\2/gi,
    '$1$2#$2',
  );
  //    Trường hợp giá trị không có dấu nháy.
  html = html.replace(
    /((?:href|src)\s*=\s*)(?:javascript|vbscript|data)\s*:[^\s>]*/gi,
    '$1#',
  );

  return html;
}

/**
 * Làm sạch một URL đơn (vd: thumbnail/banner). Chặn scheme thực thi script.
 * Trả về '' nếu URL dùng scheme nguy hiểm.
 */
export function sanitizeUrl(input?: string | null): string {
  if (!input || typeof input !== 'string') return input ?? '';
  const trimmed = input.trim();
  if (/^(?:javascript|vbscript|data)\s*:/i.test(trimmed)) return '';
  return input;
}
