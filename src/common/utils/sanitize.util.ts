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

  // 2. Xóa thuộc tính event handler on* (onclick/onerror/onload...) — CHỈ trong phạm vi THẺ
  //    (<...>) và BỎ QUA giá trị nằm trong dấu nháy. Wiki 0086 (sửa regression): bản trước dùng
  //    `[\s/]on...` toàn cục → cắt nhầm URL chứa /on… (online, onboarding) trong href hoặc text
  //    (vd href="/page/onload=x" bị mất cả dấu " đóng → vỡ HTML). Giờ alternation: nháy → giữ
  //    nguyên, handler NGOÀI nháy → xoá. Vẫn chặn bypass <svg/onload=…> (handler không nằm trong nháy).
  // [FIX M6 - wiki 0088] Outer matcher cho phép '>' NẰM TRONG nháy (title="a>b") — trước đây
  // `<[a-z][^>]*>` dừng ở '>' đầu tiên nên `<img title="a>b" onerror=x>` bị cắt, onerror lọt.
  // Inner: ngoài 2 case cũ (giá trị trong nháy giữ nguyên / handler sau dấu cách-slash), THÊM
  // case "nháy NGAY TRƯỚC handler" (vd src="x"onerror=…) — HTML5 không cần khoảng trắng giữa
  // value và attr kế → trước đây [\s/] không khớp → onerror lọt. Bắt cả `"value"on…=…`, trả lại
  // value và bỏ handler. URL trong nháy (href="/page/onload=x") vẫn an toàn vì alt nháy khớp trước.
  // [FIX review-M6 - wiki 0088] (a) catch-all NGOÀI nháy đổi [^>] → [^"'>]: bỏ nhập nhằng "nháy khớp
  // cả nhánh nháy lẫn nhánh [^>]" → diệt ReDoS backtracking mũ trên thẻ thiếu '>'. (b) nhóm handler
  // SAU nháy đổi ? → * : bắt CHUỖI nhiều handler liền (src="x"onerror="y"onmouseover="z") chứ không
  // chỉ 1 cái.
  html = html.replace(/<[a-z](?:"[^"]*"|'[^']*'|[^"'>])*>/gi, (tag) =>
    tag.replace(
      /("[^"]*"|'[^']*')(?:\s*on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))*|[\s/]on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      (_m, quoted) => (quoted ? quoted : ' '),
    ),
  );

  // 3. Vô hiệu hóa URL scheme nguy hiểm trong các thuộc tính mang URL
  //    (javascript:, vbscript:, data:).
  //    Wiki 0086: mở rộng tập thuộc tính — không chỉ href/src mà cả formaction,
  //    action, xlink:href, background, poster (vector bypass trên <button formaction=>,
  //    <form action=>, <use xlink:href=>, <body background=>, <video poster=>).
  const URL_ATTRS = '(?:href|src|formaction|action|xlink:href|background|poster)';
  // [FIX M6 - wiki 0088] `data:image/...` (ảnh base64 dán từ TipTap) là HỢP LỆ — trước đây bị thay
  // thành '#' làm vỡ ảnh blog. Giờ chỉ chặn data: KHÔNG phải image/* (data:text/html là XSS).
  const DANGER_SCHEME = '(?:javascript\\s*:|vbscript\\s*:|data\\s*:(?!\\s*image\\/))';
  //    Chỉ áp dụng cho giá trị nằm trong dấu nháy của thuộc tính.
  html = html.replace(
    new RegExp(
      `(${URL_ATTRS}\\s*=\\s*)("|')\\s*${DANGER_SCHEME}[^"']*\\2`,
      'gi',
    ),
    '$1$2#$2',
  );
  //    Trường hợp giá trị không có dấu nháy.
  html = html.replace(
    new RegExp(
      `(${URL_ATTRS}\\s*=\\s*)${DANGER_SCHEME}[^\\s>]*`,
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
