"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PrismaExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaExceptionFilter = PrismaExceptionFilter_1 = class PrismaExceptionFilter {
    logger = new common_1.Logger(PrismaExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Lỗi xử lý dữ liệu';
        if (exception instanceof client_1.Prisma.PrismaClientValidationError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = 'Dữ liệu đầu vào không hợp lệ';
        }
        else {
            switch (exception.code) {
                case 'P2002':
                    status = common_1.HttpStatus.CONFLICT;
                    message = 'Dữ liệu đã tồn tại (vi phạm ràng buộc duy nhất)';
                    break;
                case 'P2003':
                    status = common_1.HttpStatus.BAD_REQUEST;
                    message = 'Dữ liệu tham chiếu không hợp lệ';
                    break;
                case 'P2025':
                    status = common_1.HttpStatus.NOT_FOUND;
                    message = 'Không tìm thấy bản ghi';
                    break;
                case 'P2014':
                    status = common_1.HttpStatus.BAD_REQUEST;
                    message = 'Vi phạm quan hệ bắt buộc';
                    break;
                case 'P2021':
                case 'P2022': {
                    status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
                    message = 'Lỗi cấu hình dữ liệu máy chủ';
                    const meta = (exception.meta ?? {});
                    const missing = meta.column ?? meta.table ?? meta.modelName ?? '?';
                    const kind = exception.code === 'P2022' ? 'CỘT' : 'BẢNG';
                    this.logger.error(`🔴 SCHEMA DRIFT (${exception.code}): ${kind} "${missing}" không tồn tại trong DB prod. ` +
                        `Fix: chạy trên VPS \`npx prisma migrate diff --from-schema-datasource prisma/schema.prisma ` +
                        `--to-schema-datamodel prisma/schema.prisma --script\` rồi apply phần ADD COLUMN/CREATE.`);
                    break;
                }
                default:
                    this.logger.warn(`Unhandled Prisma error code ${exception.code}: ${exception.message}`);
                    break;
            }
        }
        this.logger.error(`Prisma error ${exception instanceof client_1.Prisma.PrismaClientKnownRequestError ? exception.code : 'VALIDATION'}: ${exception.message.split('\n')[0]}`);
        response.status(status).json({
            statusCode: status,
            message,
            error: common_1.HttpStatus[status],
        });
    }
};
exports.PrismaExceptionFilter = PrismaExceptionFilter;
exports.PrismaExceptionFilter = PrismaExceptionFilter = PrismaExceptionFilter_1 = __decorate([
    (0, common_1.Catch)(client_1.Prisma.PrismaClientKnownRequestError, client_1.Prisma.PrismaClientValidationError)
], PrismaExceptionFilter);
//# sourceMappingURL=prisma-exception.filter.js.map