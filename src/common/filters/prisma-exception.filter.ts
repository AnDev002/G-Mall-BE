import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Map Prisma errors → HttpException để tránh leak 500 + stack trace ra client.
 *
 * Why: BE pattern hiện tại là "service gọi Prisma trực tiếp, controller không
 * catch" — khi Prisma throw (FK violation, record không tồn tại, validation),
 * NestJS default trả 500 + nội dung lỗi nội bộ. Wiki 0023, 0024, 0027 ghi 5 bug
 * cùng pattern này (B-NEW-3, 4, 5, 9, 11). 1 filter global fix tất cả + bảo vệ
 * các endpoint chưa được test.
 *
 * Scope: catch Prisma errors phổ biến (Known + Validation). Các Prisma error
 * khác (UnknownRequest, RustPanic) vẫn để default 500 để không che bug nghiêm trọng.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi xử lý dữ liệu';

    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Sai kiểu dữ liệu, sai field, sai format UUID... — input của user xấu.
      status = HttpStatus.BAD_REQUEST;
      message = 'Dữ liệu đầu vào không hợp lệ';
    } else {
      switch (exception.code) {
        case 'P2002': // Unique constraint
          status = HttpStatus.CONFLICT;
          message = 'Dữ liệu đã tồn tại (vi phạm ràng buộc duy nhất)';
          break;
        case 'P2003': // Foreign key constraint
          status = HttpStatus.BAD_REQUEST;
          message = 'Dữ liệu tham chiếu không hợp lệ';
          break;
        case 'P2025': // Record not found (delete/update của record không tồn tại)
          status = HttpStatus.NOT_FOUND;
          message = 'Không tìm thấy bản ghi';
          break;
        case 'P2014': // Required relation violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Vi phạm quan hệ bắt buộc';
          break;
        default:
          // Code khác — log warn để có dữ liệu cải thiện filter, vẫn trả 500 default
          this.logger.warn(
            `Unhandled Prisma error code ${exception.code}: ${exception.message}`,
          );
          break;
      }
    }

    // Log chi tiết server-side (không gửi cho client)
    this.logger.error(
      `Prisma error ${exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : 'VALIDATION'}: ${exception.message.split('\n')[0]}`,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }
}
