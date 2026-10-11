import axios from 'axios';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Nhận diện ảnh theo byte đầu file (không tin đuôi file / Content-Type do client gửi). */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('::ffff:')) {
      const v4 = l.slice(7);
      return net.isIPv4(v4) ? isPrivateIp(v4) : true;
    }
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(l);
  }
  return true;
}

// Kiểm tra IP NGAY LÚC KẾT NỐI (chống DNS rebinding), không chỉ kiểm tra trước.
function safeLookup(hostname: string, options: any, callback: any) {
  dns.lookup(hostname, options, (err: any, address: any, family: any) => {
    if (err) return callback(err, address, family);
    const list = Array.isArray(address) ? address : [{ address, family }];
    if (list.some((a: any) => isPrivateIp(a.address))) {
      return callback(new Error('Địa chỉ máy chủ nội bộ bị chặn'));
    }
    callback(null, address, family);
  });
}
const httpAgent = new http.Agent({ lookup: safeLookup as any });
const httpsAgent = new https.Agent({ lookup: safeLookup as any });

/** Tải ảnh từ URL ngoài một cách an toàn. Tự theo redirect (tối đa 3 lần) và kiểm tra từng bước. */
export async function fetchImageSafe(rawUrl: string): Promise<{ buffer: Buffer; mime: ImageMime }> {
  let current = rawUrl;
  for (let hop = 0; hop <= 3; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Chỉ hỗ trợ link http/https');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    // IP literal không đi qua lookup nên phải chặn tại đây
    if (net.isIP(host) && isPrivateIp(host)) throw new Error('Địa chỉ nội bộ bị chặn');

    const res = await axios.get<ArrayBuffer>(current, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 0,
      maxContentLength: MAX_IMAGE_BYTES,
      maxBodyLength: MAX_IMAGE_BYTES,
      validateStatus: (s) => s >= 200 && s < 400,
      httpAgent,
      httpsAgent,
      proxy: false,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LoveGiftsImporter/1.0)', Accept: 'image/*' },
    });

    if (res.status >= 300) {
      const loc = res.headers['location'];
      if (!loc) throw new Error('Link chuyển hướng không hợp lệ');
      current = new URL(String(loc), current).toString();
      continue;
    }
    const buffer = Buffer.from(res.data as any);
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Ảnh lớn hơn 5MB');
    const mime = sniffImage(buffer);
    if (!mime) throw new Error('Link không phải ảnh PNG/JPG/WEBP/GIF');
    return { buffer, mime };
  }
  throw new Error('Link chuyển hướng quá nhiều lần');
}

export function friendlyErr(e: any): string {
  if (e?.code === 'ECONNABORTED') return 'Quá thời gian tải';
  if (e?.response?.status) return `Máy chủ ảnh trả lỗi ${e.response.status}`;
  if (/maxContentLength/i.test(e?.message || '')) return 'Ảnh lớn hơn 5MB';
  return e?.message || 'Lỗi không xác định';
}

/** Chạy fn song song tối đa `limit` luồng, giữ nguyên thứ tự kết quả. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}