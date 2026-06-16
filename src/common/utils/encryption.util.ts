import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LENGTH = 16;
// Wiki 0084: BẮT BUỘC key thật từ env (32 ký tự cho AES-256). Trước đây fallback công khai
// '12345...' → nếu thiếu key thì chat coi như KHÔNG mã hoá (ai có source cũng giải mã được).
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY;
// Wiki 0086: AES-256 cần key đúng 32 BYTE, không phải 32 KÝ TỰ. Trước đây check
// `.length === 32` (số ký tự JS/UTF-16) nên key 32 ký tự có dấu tiếng Việt / non-ASCII
// (mỗi ký tự nhiều byte) qua được boot rồi createCipheriv ném 'Invalid key length'
// ngay lần encrypt đầu. Validate theo byteLength để bắt lỗi tại boot như mong muốn.
if (!ENCRYPTION_KEY || Buffer.byteLength(ENCRYPTION_KEY, 'utf8') !== 32) {
  throw new Error('CHAT_ENCRYPTION_KEY chưa set hoặc không đủ 32 byte (yêu cầu cho AES-256).');
}
const KEY_BUF = Buffer.from(ENCRYPTION_KEY, 'utf8');

export class EncryptionUtil {
  static encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-cbc', KEY_BUF, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  static decrypt(text: string): string {
    try {
      if (!text || !text.includes(':')) return text; // chưa mã hoá / sai định dạng → trả nguyên
      const textParts = text.split(':');
      const ivHex = textParts.shift();
      if (!ivHex) return text;
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = createDecipheriv('aes-256-cbc', KEY_BUF, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch {
      // Wiki 0084: tin nhắn cũ mã hoá bằng key khác (sau khi đổi key) → KHÔNG vỡ API, trả placeholder.
      return '[tin nhắn không giải mã được]';
    }
  }
}
