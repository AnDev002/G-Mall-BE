"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHtml = sanitizeHtml;
exports.sanitizeUrl = sanitizeUrl;
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'noscript'];
function sanitizeHtml(input) {
    if (!input || typeof input !== 'string')
        return input ?? '';
    let html = input.replace(/\x00/g, '');
    for (const tag of DANGEROUS_TAGS) {
        const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        html = html.replace(paired, '');
        const orphan = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
        html = html.replace(orphan, '');
    }
    html = html.replace(/<[a-z](?:"[^"]*"|'[^']*'|[^"'>])*>/gi, (tag) => tag.replace(/("[^"]*"|'[^']*')(?:\s*on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))*|[\s/]on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (_m, quoted) => (quoted ? quoted : ' ')));
    const URL_ATTRS = '(?:href|src|formaction|action|xlink:href|background|poster)';
    const _ctrl = '[\\t\\n\\r\\x00]*';
    const _w = (s) => s.split('').join(_ctrl);
    const DANGER_SCHEME = `(?:${_w('javascript')}${_ctrl}:|${_w('vbscript')}${_ctrl}:|${_w('data')}${_ctrl}:(?!${_ctrl}\\s*image\\/))`;
    html = html.replace(new RegExp(`(${URL_ATTRS}\\s*=\\s*)("|')\\s*${DANGER_SCHEME}[^"']*\\2`, 'gi'), '$1$2#$2');
    html = html.replace(new RegExp(`(${URL_ATTRS}\\s*=\\s*)${DANGER_SCHEME}[^\\s>]*`, 'gi'), '$1#');
    html = html.replace(/(style\s*=\s*)("|')([^"']*)\2/gi, (_m, prefix, quote, value) => {
        const cleaned = value
            .replace(/(?:javascript|vbscript)\s*:/gi, '#')
            .replace(/expression\s*\(/gi, 'void(');
        return `${prefix}${quote}${cleaned}${quote}`;
    });
    return html;
}
function sanitizeUrl(input) {
    if (!input || typeof input !== 'string')
        return input ?? '';
    const norm = input.replace(/[\t\n\r\x00]/g, '').trim();
    if (/^(?:javascript|vbscript|data)\s*:/i.test(norm))
        return '';
    return input;
}
//# sourceMappingURL=sanitize.util.js.map