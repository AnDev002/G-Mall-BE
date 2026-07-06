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
exports.GameController = void 0;
const common_1 = require("@nestjs/common");
const gacha_service_1 = require("./gacha.service");
const jwt_guard_1 = require("../../modules/auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
let GameController = class GameController {
    gachaService;
    constructor(gachaService) {
        this.gachaService = gachaService;
    }
    async spin(user) {
        return this.gachaService.spin(user.id);
    }
};
exports.GameController = GameController;
__decorate([
    (0, common_1.Post)('gacha/spin'),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GameController.prototype, "spin", null);
exports.GameController = GameController = __decorate([
    (0, common_1.Controller)('games'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [gacha_service_1.GachaService])
], GameController);
//# sourceMappingURL=game.controller.js.map