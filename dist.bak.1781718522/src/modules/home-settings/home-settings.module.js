"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const home_settings_controller_1 = require("./home-settings.controller");
const home_settings_service_1 = require("./home-settings.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const category_module_1 = require("../category/category.module");
const database_module_1 = require("../../database/database.module");
let HomeSettingsModule = class HomeSettingsModule {
};
exports.HomeSettingsModule = HomeSettingsModule;
exports.HomeSettingsModule = HomeSettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            category_module_1.CategoryModule
        ],
        controllers: [home_settings_controller_1.HomeSettingsController],
        providers: [home_settings_service_1.HomeSettingsService, prisma_service_1.PrismaService],
        exports: [home_settings_service_1.HomeSettingsService]
    })
], HomeSettingsModule);
//# sourceMappingURL=home-settings.module.js.map