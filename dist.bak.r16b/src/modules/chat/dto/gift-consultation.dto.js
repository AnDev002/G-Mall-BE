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
exports.GiftConsultationDto = exports.UserReplyDto = exports.ConsultationStep = void 0;
const class_validator_1 = require("class-validator");
var ConsultationStep;
(function (ConsultationStep) {
    ConsultationStep["INIT"] = "INIT";
    ConsultationStep["ASK_RECIPIENT"] = "ASK_RECIPIENT";
    ConsultationStep["ASK_OCCASION"] = "ASK_OCCASION";
    ConsultationStep["ASK_RELATIONSHIP"] = "ASK_RELATIONSHIP";
    ConsultationStep["ASK_INTERESTS"] = "ASK_INTERESTS";
    ConsultationStep["ASK_BUDGET"] = "ASK_BUDGET";
    ConsultationStep["RECOMMENDING"] = "RECOMMENDING";
    ConsultationStep["COMPLETED"] = "COMPLETED";
})(ConsultationStep || (exports.ConsultationStep = ConsultationStep = {}));
class UserReplyDto {
    message;
    sessionId;
}
exports.UserReplyDto = UserReplyDto;
class GiftConsultationDto {
    recipient;
    occasion;
    interests;
    budgetRange;
}
exports.GiftConsultationDto = GiftConsultationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], GiftConsultationDto.prototype, "recipient", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], GiftConsultationDto.prototype, "occasion", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], GiftConsultationDto.prototype, "interests", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], GiftConsultationDto.prototype, "budgetRange", void 0);
//# sourceMappingURL=gift-consultation.dto.js.map