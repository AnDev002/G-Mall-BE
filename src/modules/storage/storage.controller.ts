import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { R2Service } from './r2.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

@Controller()
export class StorageController {
  constructor(private readonly r2Service: R2Service) {}

  @Public()
  @Post('storage/presigned')
  @UseGuards(JwtAuthGuard)
  async getPresignedUrl(@Body() body: { fileName: string; fileType: string }) {
    return this.r2Service.generatePresignedUrl(body.fileName, body.fileType);
  }

  @Post('storage/presigned-url')
  @UseGuards(JwtAuthGuard)
  async getUploadUrl(@Body() body: { fileName: string; fileType: string; folder?: string }) {
    return this.r2Service.generatePresignedUrl(body.fileName, body.fileType, body.folder);
  }

  // FE `AuthService.uploadAvatar` đang POST /upload trực tiếp với multipart.
  // Endpoint mới: nhận file → upload lên R2 → trả `{ url }` để FE lưu avatar.
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadDirect(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Thiếu file');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Định dạng ảnh không hỗ trợ (chỉ PNG/JPEG/WEBP/GIF)');
    }
    const { url } = await this.r2Service.uploadDirect(
      file.buffer,
      file.originalname,
      file.mimetype,
      'avatars',
    );
    return { url };
  }
}
