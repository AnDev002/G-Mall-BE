// BE/common/utils/sanitize.util.ts
// Dependency-free HTML sanitizer for blog content (Stored XSS defense).
// Không thêm npm package (sanitize-html/dompurify) — chỉ strip các vector nguy hiểm:
//   - thẻ <script> / <iframe> / <object> / <embed> (cả nội dung bên trong)
//   - thuộc tính event handler on* (onclick, onerror, onload, ...)
//   - URL scheme javascript: / vbscript: / data: trong các thuộc tính mang URL
//     (Wiki 0086: href|src|formaction|action|xlink:href|background|poster), không
//     chỉ href/src — trước đây formaction=javascript:... lọt.
//   - javascript: / expression(...) bên trong inline style="...url(...)..." (Wiki 0086)
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

  // 3. Vô hiệu hóa URL scheme nguy hiểm trong các thuộc tính mang URL
  //    (javascript:, vbscript:, data:).
  //    Wiki 0086: mở rộng tập thuộc tính — không chỉ href/src mà cả formaction,
  //    action, xlink:href, background, poster (vector bypass trên <button formaction=>,
  //    <form action=>, <use xlink:href=>, <body background=>, <video poster=>).
  const URL_ATTRS = '(?:href|src|formaction|action|xlink:href|background|poster)';
  //    Chỉ áp dụng cho giá trị nằm trong dấu nháy của thuộc tính.
  html = html.replace(
    new RegExp(
      `(${URL_ATTRS}\\s*=\\s*)("|')\\s*(?:javascript|vbscript|data)\\s*:[^"']*\\2`,
      'gi',
    ),
    '$1$2#$2',
  );
  //    Trường hợp giá trị không có dấu nháy.
  html = html.replace(
    new RegExp(
      `(${URL_ATTRS}\\s*=\\s*)(?:javascript|vbscript|data)\\s*:[^\\s>]*`,
      'gi',
    ),
    '$1#',
  );

  // 4. Wiki 0086: vô hiệu hóa scheme nguy hiểm bên trong inline style — vd
  //    style="background:url(javascript:alert(1))" hoặc width:expression(alert(1)).
  //    Header comment đã hứa lọc style nhưng trước đây không có bước này.
  //    Thay javascript:/vbscript: và expression( bằng token vô hại trong style="...".
  html = html.replace(
    /(style\s*=\s*)("|')([^"']*)\2/gi,
    (_m, prefix: string, quote: string, value: string) => {
      const cleaned = value
        .replace(/(?:javascript|vbscript)\s*:/gi, '#')
        .replace(/expression\s*\(/gi, 'void(');
      return `${prefix}${quote}${cleaned}${quote}`;
    },
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
