"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharityModule = void 0;
const common_1 = require("@nestjs/common");
const charity_service_1 = require("./charity.service");
const charity_controller_1 = require("./charity.controller");
const auth_module_1 = require("../auth/auth.module");
const redis_module_1 = require("../../database/redis/redis.module");
let CharityModule = class CharityModule {
};
exports.CharityModule = CharityModule;
exports.CharityModule = CharityModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, redis_module_1.RedisModule],
        controllers: [charity_controller_1.CharityController, charity_controller_1.AdminCharityController],
        providers: [charity_service_1.CharityService],
        exports: [charity_service_1.CharityService],
    })
], CharityModule);
//# sourceMappingURL=charity.module.js.map