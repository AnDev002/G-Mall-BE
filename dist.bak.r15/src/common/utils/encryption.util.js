"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionUtil = void 0;
const crypto_1 = require("crypto");
const IV_LENGTH = 16;
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || Buffer.byteLength(ENCRYPTION_KEY, 'utf8') !== 32) {
    throw new Error('CHAT_ENCRYPTION_KEY chưa set hoặc không đủ 32 byte (yêu cầu cho AES-256).');
}
const KEY_BUF = Buffer.from(ENCRYPTION_KEY, 'utf8');
class EncryptionUtil {
    static encrypt(text) {
        const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', KEY_BUF, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }
    static decrypt(text) {
        try {
            if (!text || !text.includes(':'))
                return text;
            const textParts = text.split(':');
            const ivHex = textParts.shift();
            if (!ivHex)
                return text;
            const iv = Buffer.from(ivHex, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', KEY_BUF, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        }
        catch {
            return '[tin nhắn không giải mã được]';
        }
    }
}
exports.EncryptionUtil = EncryptionUtil;
//# sourceMappingURL=encryption.util.js.map