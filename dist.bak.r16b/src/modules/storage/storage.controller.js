"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const r2_service_1 = require("./r2.service");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const presign_dto_1 = require("./dto/presign.dto");
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
let StorageController = class StorageController {
    r2Service;
    constructor(r2Service) {
        this.r2Service = r2Service;
    }
    async getPresignedUrl(body) {
        return this.r2Service.generatePresignedUrl(body.fileName, body.fileType);
    }
    async getUploadUrl(body) {
        return this.r2Service.generatePresignedUrl(body.fileName, body.fileType, body.folder);
    }
    async uploadDirect(file) {
        if (!file)
            throw new common_1.BadRequestException('Thiếu file');
        if (!presign_dto_1.ALLOWED_MIMES.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Định dạng ảnh không hỗ trợ (chỉ PNG/JPEG/WEBP/GIF)');
        }
        const { url } = await this.r2Service.uploadDirect(file.buffer, file.originalname, file.mimetype, 'avatars');
        return { url };
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, common_1.Post)('storage/presigned'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [presign_dto_1.PresignDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getPresignedUrl", null);
__decorate([
    (0, common_1.Post)('storage/presigned-url'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [presign_dto_1.UploadUrlDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getUploadUrl", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "uploadDirect", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [r2_service_1.R2Service])
], StorageController);
//# sourceMappingURL=storage.controller.js.map