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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadUrlDto = exports.PresignDto = exports.ALLOWED_FOLDERS = exports.ALLOWED_MIMES = void 0;
const class_validator_1 = require("class-validator");
exports.ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
exports.ALLOWED_FOLDERS = ['products', 'avatars', 'banners', 'blogs'];
class PresignDto {
    fileName;
    fileType;
}
exports.PresignDto = PresignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PresignDto.prototype, "fileName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsIn)(exports.ALLOWED_MIMES, { message: 'Định dạng ảnh không hỗ trợ' }),
    __metadata("design:type", String)
], PresignDto.prototype, "fileType", void 0);
class UploadUrlDto extends PresignDto {
    folder;
}
exports.UploadUrlDto = UploadUrlDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(exports.ALLOWED_FOLDERS, { message: 'Thư mục không hợp lệ' }),
    __metadata("design:type", String)
], UploadUrlDto.prototype, "folder", void 0);
//# sourceMappingURL=presign.dto.js.map