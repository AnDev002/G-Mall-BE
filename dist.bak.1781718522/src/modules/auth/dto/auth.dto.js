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
exports.VerifyOtpDto = exports.SendOtpDto = exports.LoginDto = exports.RegisterSellerDto = exports.RegisterDto = void 0;
const class_validator_1 = require("class-validator");
class RegisterDto {
    email;
    password;
    name;
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }),
    (0, class_validator_1.MaxLength)(128, { message: 'Mật khẩu không được dài quá 128 ký tự' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập họ tên' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Họ tên không được dài quá 100 ký tự' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "name", void 0);
class RegisterSellerDto {
    email;
    password;
    name;
    shopName;
    phoneNumber;
    pickupAddress;
    taxCode;
}
exports.RegisterSellerDto = RegisterSellerDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(254),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập họ tên' }),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập tên Shop' }),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "shopName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập số điện thoại' }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập địa chỉ lấy hàng' }),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "pickupAddress", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập Mã số thuế/CCCD' }),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], RegisterSellerDto.prototype, "taxCode", void 0);
class LoginDto {
    email;
    password;
}
exports.LoginDto = LoginDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập mật khẩu' }),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class SendOtpDto {
    email;
}
exports.SendOtpDto = SendOtpDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendOtpDto.prototype, "email", void 0);
class VerifyOtpDto {
    email;
    otp;
}
exports.VerifyOtpDto = VerifyOtpDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 6, { message: 'Mã OTP phải có 6 ký tự' }),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "otp", void 0);
//# sourceMappingURL=auth.dto.js.map