import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

// Map MIME (đã validate ở controller) -> phần mở rộng cố định. Lấy ext theo
// MIME chứ KHÔNG lấy theo fileName do client gửi (fileName là attacker-controlled).
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicDomain: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') ?? '';
    this.publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN') ?? '';

    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') ?? '';

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true,
      
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async generatePresignedUrl(fileName: string, fileType: string, folder: string = 'products') {
    try {
      // Phần mở rộng lấy theo MIME đã validate, KHÔNG lấy theo fileName client gửi
      // (fileName là attacker-controlled, có thể chứa `..`, `/`, hoặc ext giả).
      const fileExtension = MIME_EXTENSION_MAP[fileType];
      if (!fileExtension) {
        throw new InternalServerErrorException('Unsupported file type');
      }

      const safeFileName = uuidv4();
      const key = `${folder}/${safeFileName}.${fileExtension}`;

      // Wiki 0086: KHÔNG ký Content-Length cố định. SDK presign ký từng header rời; ký
      // ContentLength=5MB buộc MỌI upload phải gửi đúng 5MB → file thật (vài KB) luôn sai chữ ký
      // → 403 SignatureDoesNotMatch (HỎNG TOÀN BỘ upload, regression round10). Chỉ ký content-type;
      // giới hạn dung lượng dựa vào cấu hình bucket R2 (chống upload khổng lồ) chứ không ký ở đây.
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: fileType,
        // ACL: 'public-read', // R2 thường không cần cái này nếu bucket public, nhưng nếu lỗi Access Denied thì hãy thử bật lại
      });

      // Tạo URL ký sẵn; chỉ ép content-type vào chữ ký (không ép content-length).
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 300,
        signableHeaders: new Set(['content-type']),
      });

      return {
        uploadUrl,
        fileUrl: `${this.publicDomain}/${key}`,
      };
    } catch (error) {
      console.error('R2 Presigned Error:', error);
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Could not generate upload URL');
    }
  }

  async uploadDirect(buffer: Buffer, originalName: string, mime: string, folder: string = 'avatars') {
    try {
      // Ưu tiên ext theo MIME (đã validate ở controller); chỉ fallback sang ext
      // từ originalName khi MIME chưa map, và sanitize để loại '..' '/' ký tự lạ.
      const rawExt = (originalName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const ext = MIME_EXTENSION_MAP[mime] || rawExt || 'bin';
      const key = `${folder}/${uuidv4()}.${ext}`;
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mime,
      }));
      return { url: `${this.publicDomain}/${key}`, key };
    } catch (error) {
      console.error('R2 Direct Upload Error:', error);
      throw new InternalServerErrorException('Upload thất bại, vui lòng thử lại');
    }
  }

  async deleteFile(key: string) {
    try {
        // Xử lý key: Nếu key truyền vào là full URL, cần cắt bỏ phần domain.
        // Dùng startsWith (không phải includes) để chỉ strip prefix đúng domain,
        // và guard publicDomain rỗng để tránh strip nhầm / cắt sai key.
        let cleanKey = key;
        if (this.publicDomain) {
            const prefix = `${this.publicDomain}/`;
            if (cleanKey.startsWith(prefix)) {
                cleanKey = cleanKey.slice(prefix.length);
            } else if (cleanKey.startsWith(this.publicDomain)) {
                cleanKey = cleanKey.slice(this.publicDomain.length);
            }
        }
        // Bỏ slash thừa ở đầu (nếu URL có dạng domain//key hoặc key bắt đầu bằng '/')
        cleanKey = cleanKey.replace(/^\/+/, '');

        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        });
        await this.s3Client.send(command);
    } catch (error) {
        console.error('R2 Delete Error (Ignored):', error);
    }
  }
}