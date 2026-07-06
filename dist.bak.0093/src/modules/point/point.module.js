"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointModule = void 0;
const common_1 = require("@nestjs/common");
const point_service_1 = require("./point.service");
const point_controller_1 = require("./point.controller");
const database_module_1 = require("../../database/database.module");
const redis_module_1 = require("../../database/redis/redis.module");
let PointModule = class PointModule {
};
exports.PointModule = PointModule;
exports.PointModule = PointModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
        ],
        controllers: [point_controller_1.PointController],
        providers: [point_service_1.PointService],
        exports: [point_service_1.PointService],
    })
], PointModule);
//# sourceMappingURL=point.module.js.map