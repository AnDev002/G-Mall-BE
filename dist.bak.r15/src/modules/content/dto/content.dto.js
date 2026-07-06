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
exports.SaveConfigDto = exports.ReorderBannersDto = exports.UpdateBannerDto = exports.CreateBannerDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateBannerDto {
    location;
    src;
    alt;
    title;
    description;
    ctaLabel;
    ctaLink;
    theme;
    order;
    isActive;
}
exports.CreateBannerDto = CreateBannerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "src", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "alt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "ctaLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "ctaLink", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "theme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateBannerDto.prototype, "order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBannerDto.prototype, "isActive", void 0);
class UpdateBannerDto extends CreateBannerDto {
}
exports.UpdateBannerDto = UpdateBannerDto;
class ReorderItem {
    id;
    order;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReorderItem.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ReorderItem.prototype, "order", void 0);
class ReorderBannersDto {
    items;
}
exports.ReorderBannersDto = ReorderBannersDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReorderItem),
    __metadata("design:type", Array)
], ReorderBannersDto.prototype, "items", void 0);
class SaveConfigDto {
    key;
    value;
}
exports.SaveConfigDto = SaveConfigDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveConfigDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Object)
], SaveConfigDto.prototype, "value", void 0);
//# sourceMappingURL=content.dto.js.map