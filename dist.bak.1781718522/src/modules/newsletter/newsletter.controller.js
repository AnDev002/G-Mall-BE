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
exports.NewsletterController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const newsletter_service_1 = require("./newsletter.service");
class SubscribeDto {
    email;
    sourceTag;
}
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    __metadata("design:type", String)
], SubscribeDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], SubscribeDto.prototype, "sourceTag", void 0);
class UnsubscribeDto {
    email;
}
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    __metadata("design:type", String)
], UnsubscribeDto.prototype, "email", void 0);
let NewsletterController = class NewsletterController {
    service;
    constructor(service) {
        this.service = service;
    }
    subscribe(dto) {
        return this.service.subscribe(dto.email, dto.sourceTag);
    }
    unsubscribe(dto) {
        return this.service.unsubscribe(dto.email);
    }
};
exports.NewsletterController = NewsletterController;
__decorate([
    (0, common_1.Post)('subscribe'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SubscribeDto]),
    __metadata("design:returntype", void 0)
], NewsletterController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Post)('unsubscribe'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UnsubscribeDto]),
    __metadata("design:returntype", void 0)
], NewsletterController.prototype, "unsubscribe", null);
exports.NewsletterController = NewsletterController = __decorate([
    (0, common_1.Controller)('newsletter'),
    __metadata("design:paramtypes", [newsletter_service_1.NewsletterService])
], NewsletterController);
//# sourceMappingURL=newsletter.controller.js.map