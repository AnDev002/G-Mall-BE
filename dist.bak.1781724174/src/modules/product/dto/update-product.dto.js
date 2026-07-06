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
exports.UpdateProductDto = exports.UpdateProductDiscountDto = exports.ProductVariantDiscountDto = exports.DiscountType = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_product_dto_1 = require("./create-product.dto");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
var DiscountType;
(function (DiscountType) {
    DiscountType["PERCENT"] = "PERCENT";
})(DiscountType || (exports.DiscountType = DiscountType = {}));
class ProductVariantDiscountDto {
    id;
    discountValue;
}
exports.ProductVariantDiscountDto = ProductVariantDiscountDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProductVariantDiscountDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ProductVariantDiscountDto.prototype, "discountValue", void 0);
class UpdateProductDiscountDto {
    discountType;
    discountValue;
    discountStartDate;
    discountEndDate;
    isDiscountActive;
    variants;
}
exports.UpdateProductDiscountDto = UpdateProductDiscountDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsEnum)(DiscountType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateProductDiscountDto.prototype, "discountType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateProductDiscountDto.prototype, "discountValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateProductDiscountDto.prototype, "discountStartDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateProductDiscountDto.prototype, "discountEndDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateProductDiscountDto.prototype, "isDiscountActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ProductVariantDiscountDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ProductVariantDiscountDto),
    __metadata("design:type", Array)
], UpdateProductDiscountDto.prototype, "variants", void 0);
class UpdateProductDto extends (0, mapped_types_1.PartialType)(create_product_dto_1.CreateProductDto) {
}
exports.UpdateProductDto = UpdateProductDto;
//# sourceMappingURL=update-product.dto.js.map