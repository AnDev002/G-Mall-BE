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
exports.AddressController = void 0;
const common_1 = require("@nestjs/common");
const address_service_1 = require("./address.service");
const address_dto_1 = require("./dto/address.dto");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
let AddressController = class AddressController {
    addressService;
    constructor(addressService) {
        this.addressService = addressService;
    }
    create(userId, dto) {
        return this.addressService.create(userId, dto);
    }
    findAll(userId) {
        return this.addressService.findAll(userId);
    }
    update(userId, id, dto) {
        return this.addressService.update(userId, id, dto);
    }
    remove(userId, id) {
        return this.addressService.remove(userId, id);
    }
    setDefault(userId, id) {
        return this.addressService.setDefault(userId, id);
    }
};
exports.AddressController = AddressController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, address_dto_1.CreateAddressDto]),
    __metadata("design:returntype", void 0)
], AddressController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AddressController.prototype, "findAll", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, address_dto_1.UpdateAddressDto]),
    __metadata("design:returntype", void 0)
], AddressController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AddressController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)(':id/default'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AddressController.prototype, "setDefault", null);
exports.AddressController = AddressController = __decorate([
    (0, common_1.Controller)('addresses'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [address_service_1.AddressService])
], AddressController);
//# sourceMappingURL=address.controller.js.map