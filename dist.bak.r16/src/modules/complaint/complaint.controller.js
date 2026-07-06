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
exports.AdminComplaintController = exports.ComplaintController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const complaint_service_1 = require("./complaint.service");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
class CreateComplaintDto {
    category;
    title;
    content;
    relatedOrderId;
    attachments;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['shipping', 'product', 'finance', 'system', 'other']),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "relatedOrderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(500, { each: true }),
    __metadata("design:type", Array)
], CreateComplaintDto.prototype, "attachments", void 0);
class UpdateStatusDto {
    status;
    adminNote;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['open', 'processing', 'resolved', 'rejected']),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "adminNote", void 0);
let ComplaintController = class ComplaintController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(req, dto) {
        return this.service.create(req.user.userId, dto);
    }
    listMine(req, q) {
        return this.service.listMine(req.user.userId, {
            page: q.page ? Number(q.page) : undefined,
            limit: q.limit ? Number(q.limit) : undefined,
            status: q.status,
        });
    }
    findOne(req, id) {
        return this.service.findOneAsOwner(req.user.userId, id);
    }
};
exports.ComplaintController = ComplaintController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateComplaintDto]),
    __metadata("design:returntype", void 0)
], ComplaintController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ComplaintController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComplaintController.prototype, "findOne", null);
exports.ComplaintController = ComplaintController = __decorate([
    (0, common_1.Controller)('complaints'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [complaint_service_1.ComplaintService])
], ComplaintController);
let AdminComplaintController = class AdminComplaintController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(q) {
        return this.service.listAll({
            page: q.page ? Number(q.page) : undefined,
            limit: q.limit ? Number(q.limit) : undefined,
            status: q.status,
        });
    }
    updateStatus(id, dto) {
        return this.service.updateStatus(id, dto.status, dto.adminNote);
    }
};
exports.AdminComplaintController = AdminComplaintController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminComplaintController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateStatusDto]),
    __metadata("design:returntype", void 0)
], AdminComplaintController.prototype, "updateStatus", null);
exports.AdminComplaintController = AdminComplaintController = __decorate([
    (0, common_1.Controller)('admin/complaints'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __metadata("design:paramtypes", [complaint_service_1.ComplaintService])
], AdminComplaintController);
//# sourceMappingURL=complaint.controller.js.map