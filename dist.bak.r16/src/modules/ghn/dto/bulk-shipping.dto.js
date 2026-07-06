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
exports.BulkRequestPickupDto = exports.BulkChangePickupDateDto = exports.BulkUpdateAddressDto = exports.BulkUpdateAddressItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const BULK_MAX = 50;
class BulkUpdateAddressItemDto {
    orderId;
    recipientAddress;
    districtId;
    wardCode;
    provinceId;
    recipientName;
    recipientPhone;
}
exports.BulkUpdateAddressItemDto = BulkUpdateAddressItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BulkUpdateAddressItemDto.prototype, "orderId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BulkUpdateAddressItemDto.prototype, "recipientAddress", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BulkUpdateAddressItemDto.prototype, "districtId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BulkUpdateAddressItemDto.prototype, "wardCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BulkUpdateAddressItemDto.prototype, "provinceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkUpdateAddressItemDto.prototype, "recipientName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkUpdateAddressItemDto.prototype, "recipientPhone", void 0);
class BulkUpdateAddressDto {
    items;
}
exports.BulkUpdateAddressDto = BulkUpdateAddressDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(BULK_MAX),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkUpdateAddressItemDto),
    __metadata("design:type", Array)
], BulkUpdateAddressDto.prototype, "items", void 0);
class BulkChangePickupDateDto {
    orderIds;
    pickupDate;
}
exports.BulkChangePickupDateDto = BulkChangePickupDateDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(BULK_MAX),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkChangePickupDateDto.prototype, "orderIds", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BulkChangePickupDateDto.prototype, "pickupDate", void 0);
class BulkRequestPickupDto {
    orderIds;
}
exports.BulkRequestPickupDto = BulkRequestPickupDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(BULK_MAX),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkRequestPickupDto.prototype, "orderIds", void 0);
//# sourceMappingURL=bulk-shipping.dto.js.map