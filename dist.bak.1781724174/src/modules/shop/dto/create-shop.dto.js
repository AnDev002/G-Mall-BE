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
exports.CreateShopDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CreateShopDto {
    name;
    pickupAddress;
    description;
    avatar;
    coverImage;
    provinceId;
    districtId;
    wardCode;
    lat;
    lng;
}
exports.CreateShopDto = CreateShopDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Tên Shop không được để trống' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'Tên Shop phải có ít nhất 2 ký tự' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Tên Shop tối đa 100 ký tự' }),
    __metadata("design:type", String)
], CreateShopDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Địa chỉ lấy hàng không được để trống' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255, { message: 'Địa chỉ lấy hàng tối đa 255 ký tự' }),
    __metadata("design:type", String)
], CreateShopDto.prototype, "pickupAddress", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000, { message: 'Mô tả shop tối đa 1000 ký tự' }),
    __metadata("design:type", String)
], CreateShopDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateShopDto.prototype, "avatar", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateShopDto.prototype, "coverImage", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Province ID là bắt buộc' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    __metadata("design:type", Number)
], CreateShopDto.prototype, "provinceId", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'District ID là bắt buộc' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    __metadata("design:type", Number)
], CreateShopDto.prototype, "districtId", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Ward Code là bắt buộc' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateShopDto.prototype, "wardCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(({ value }) => value ? Number(value) : 0),
    __metadata("design:type", Number)
], CreateShopDto.prototype, "lat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(({ value }) => value ? Number(value) : 0),
    __metadata("design:type", Number)
], CreateShopDto.prototype, "lng", void 0);
//# sourceMappingURL=create-shop.dto.js.map