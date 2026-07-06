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
exports.HandleRequestDto = exports.InviteByEmailDto = exports.FriendRequestDto = void 0;
const class_validator_1 = require("class-validator");
class FriendRequestDto {
    receiverId;
}
exports.FriendRequestDto = FriendRequestDto;
__decorate([
    (0, class_validator_1.IsUUID)('all', { message: 'receiverId phải là UUID hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FriendRequestDto.prototype, "receiverId", void 0);
class InviteByEmailDto {
    email;
    message;
}
exports.InviteByEmailDto = InviteByEmailDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập email' }),
    __metadata("design:type", String)
], InviteByEmailDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Vui lòng nhập lời nhắn' }),
    __metadata("design:type", String)
], InviteByEmailDto.prototype, "message", void 0);
class HandleRequestDto {
    requestId;
    action;
}
exports.HandleRequestDto = HandleRequestDto;
__decorate([
    (0, class_validator_1.IsUUID)('all', { message: 'requestId phải là UUID hợp lệ' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], HandleRequestDto.prototype, "requestId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['ACCEPT', 'REJECT']),
    __metadata("design:type", String)
], HandleRequestDto.prototype, "action", void 0);
//# sourceMappingURL=friend.dto.js.map