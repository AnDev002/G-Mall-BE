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
exports.RegisterSellerDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class RegisterSellerDto {
    email;
    password;
    name;
    phoneNumber;
    shopName;
    categoryId;
    pickupAddress;
    provinceId;
    districtId;
    wardCode;
    lat;
    lng;
    businessType;
    taxCode;
    businessLicenseFront;
    businessLicenseBack;
}
exports.RegisterSellerDto = RegisterSellerDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' }),
    (0, class_validator_1.Matches)(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'Mật khẩu phải có chữ hoa, chữ thường và số/ký tự đặc biệt'
    }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(2, { message: 'Họ tên quá ngắn' }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Số điện thoại là bắt buộc' }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(5, { message: 'Tên Shop phải từ 5 ký tự trở lên' }),
    (0, class_validator_1.MaxLength)(50, { message: 'Tên Shop tối đa 50 ký tự' }),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/, {
        message: 'Tên Shop không được chứa ký tự đặc biệt'
    }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "shopName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng chọn ngành hàng kinh doanh' }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Địa chỉ lấy hàng là bắt buộc' }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "pickupAddress", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    __metadata("design:type", Number)
], RegisterSellerDto.prototype, "provinceId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    __metadata("design:type", Number)
], RegisterSellerDto.prototype, "districtId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "wardCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    __metadata("design:type", Number)
], RegisterSellerDto.prototype, "lat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    __metadata("design:type", Number)
], RegisterSellerDto.prototype, "lng", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "businessType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[0-9]{10}$|^[0-9]{13}$/, {
        message: 'Mã số thuế/CCCD không hợp lệ'
    }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "taxCode", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Ảnh mặt trước là bắt buộc' }),
    (0, class_validator_1.IsUrl)({}, { message: 'URL ảnh mặt trước không hợp lệ' }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "businessLicenseFront", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Ảnh mặt sau là bắt buộc' }),
    (0, class_validator_1.IsUrl)({}, { message: 'URL ảnh mặt sau không hợp lệ' }),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "businessLicenseBack", void 0);
//# sourceMappingURL=register-seller.dto.js.map